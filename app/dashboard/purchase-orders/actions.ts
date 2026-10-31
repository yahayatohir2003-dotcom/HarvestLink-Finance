"use server";

/**
 * HarvestLink Finance - Purchase Order Server Actions
 *
 * Implements full server-side validation, role-based authorization,
 * automated line-item calculations, database persistence across
 * 'purchase_orders' and 'order_items', and audit logging to 'audit_logs'.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderStatus,
  OrderItemInput,
} from "@/types/purchase-order";
import {
  calculateLineTotal,
  calculateOrderTotal,
  encodePoDescription,
  generatePoReference,
} from "@/lib/po-utils";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Retrieve verified supplier organisations for the purchase order creation dropdown.
 */
export async function getSuppliersListAction(): Promise<
  ActionResult<Array<{ id: string; name: string; organization_type: string; address: string | null; phone: string | null }>>
> {
  try {
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
    }

    // Query supplier organisations from 'organizations' table
    const { data: suppliers, error } = await supabase
      .from("organizations")
      .select("id, name, organization_type, address, phone")
      .eq("organization_type", "supplier")
      .order("name", { ascending: true });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data: suppliers || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load suppliers.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Create a new Purchase Order with multiple agricultural line items.
 * Enforces buyer authorization, validates organisations, automatically computes
 * line totals and order total, and records an immutable entry in 'audit_logs'.
 */
export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderInput
): Promise<ActionResult<{ orderId: string; orderReference: string }>> {
  try {
    // 1. Authenticate user via SSR Supabase client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "You must be logged in to create a purchase order." };
    }

    // 2. Query user profile to verify role and linked organisation
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return { success: false, message: "Unable to verify user profile." };
    }

    // Enforce role restriction: Only Buyers (or Admin) can create purchase orders
    if (profile.role !== "buyer" && profile.role !== "admin") {
      return {
        success: false,
        message: "Access restricted: Only registered corporate buyers can issue purchase orders.",
      };
    }

    if (!profile.organization_id) {
      return {
        success: false,
        message: "Your profile is not linked to a registered organisation. Please complete registration.",
      };
    }

    // 3. Verify buyer organisation exists in 'organizations' table
    const admin = createAdminClient();
    const { data: buyerOrg, error: buyerOrgErr } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (buyerOrgErr || !buyerOrg) {
      return { success: false, message: "Buyer organisation record could not be found." };
    }

    // 4. Verify supplier organisation exists in 'organizations' table
    if (!input.supplierOrganizationId?.trim()) {
      return { success: false, message: "Please select a verified supplier organisation." };
    }

    const { data: supplierOrg, error: supplierOrgErr } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", input.supplierOrganizationId)
      .maybeSingle();

    if (supplierOrgErr || !supplierOrg) {
      return { success: false, message: "Selected supplier organisation does not exist." };
    }

    // 5. Validate mandatory input fields
    if (!input.deliveryAddress?.trim()) {
      return { success: false, message: "Delivery address is required for agricultural fulfillment." };
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, message: "A purchase order must contain at least one product item." };
    }

    // 6. Validate and calculate each line item
    const sanitizedItems: Array<{
      itemName: string;
      description: string | null;
      quantity: number;
      unit: string;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (let i = 0; i < input.items.length; i++) {
      const itm = input.items[i];
      if (!itm.itemName?.trim()) {
        return { success: false, message: `Line item #${i + 1} is missing a commodity name.` };
      }
      const qty = Number(itm.quantity);
      if (isNaN(qty) || qty <= 0) {
        return { success: false, message: `Line item '${itm.itemName}' must have a quantity greater than zero.` };
      }
      if (!itm.unit?.trim()) {
        return { success: false, message: `Line item '${itm.itemName}' must have a packaging unit specified.` };
      }
      const price = Number(itm.unitPrice);
      if (isNaN(price) || price < 0) {
        return { success: false, message: `Line item '${itm.itemName}' must have a valid non-negative unit price.` };
      }

      const calculatedLineTotal = calculateLineTotal(qty, price);
      sanitizedItems.push({
        itemName: itm.itemName.trim(),
        description: itm.description?.trim() || null,
        quantity: qty,
        unit: itm.unit.trim(),
        unitPrice: price,
        lineTotal: calculatedLineTotal,
      });
    }

    // 7. Calculate grand total for the purchase order
    const totalAmount = calculateOrderTotal(sanitizedItems);

    // 8. Generate or validate unique order reference
    let orderRef = input.orderReference?.trim();
    if (!orderRef) {
      orderRef = generatePoReference();
    }

    // Check if order reference is already in use
    const { data: existingPo } = await admin
      .from("purchase_orders")
      .select("id")
      .eq("order_reference", orderRef)
      .maybeSingle();

    if (existingPo) {
      // Append unique timestamp suffix if collision occurs
      orderRef = `${orderRef}-${Date.now().toString().slice(-4)}`;
    }

    // 9. Encode Delivery Address and Notes into 'purchase_orders.description'
    const encodedDescription = encodePoDescription({
      deliveryAddress: input.deliveryAddress,
      notes: input.notes,
    });

    const initialStatus: PurchaseOrderStatus = input.status === "submitted" ? "submitted" : "draft";

    // 10. Insert purchase order header into 'purchase_orders' table
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .insert({
        order_reference: orderRef,
        buyer_organization_id: profile.organization_id,
        supplier_organization_id: input.supplierOrganizationId,
        created_by: user.id,
        order_date: input.orderDate || new Date().toISOString().split("T")[0],
        expected_delivery_date: input.expectedDeliveryDate || null,
        currency: "NGN",
        total_amount: totalAmount,
        status: initialStatus,
        description: encodedDescription,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, order_reference")
      .single();

    if (poErr || !po) {
      return { success: false, message: `Failed to create purchase order: ${poErr?.message || "Unknown error"}` };
    }

    // 11. Insert line items into 'order_items' table
    const orderItemsToInsert = sanitizedItems.map((item) => ({
      purchase_order_id: po.id,
      item_name: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      created_at: new Date().toISOString(),
    }));

    const { error: itemsErr } = await admin.from("order_items").insert(orderItemsToInsert);

    if (itemsErr) {
      // Rollback PO if line items insertion failed
      await admin.from("purchase_orders").delete().eq("id", po.id);
      return { success: false, message: `Failed to insert order line items: ${itemsErr.message}` };
    }

    // 12. Record the action in 'audit_logs' table
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "PURCHASE_ORDER_CREATED",
      entity_table: "purchase_orders",
      entity_id: po.id,
      details: {
        order_reference: po.order_reference,
        buyer_organization_id: profile.organization_id,
        supplier_organization_id: input.supplierOrganizationId,
        total_amount: totalAmount,
        items_count: sanitizedItems.length,
        status: initialStatus,
      },
      created_at: new Date().toISOString(),
    });

    revalidatePath("/dashboard/purchase-orders");
    revalidatePath("/dashboard/buyer");
    revalidatePath("/dashboard/supplier");

    return {
      success: true,
      message: `Purchase Order ${po.order_reference} created successfully!`,
      data: { orderId: po.id, orderReference: po.order_reference },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create purchase order.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Update an existing draft Purchase Order.
 * Restricts updates to the owning buyer and only when the order is in 'draft' status.
 */
export async function updatePurchaseOrderAction(
  orderId: string,
  input: UpdatePurchaseOrderInput
): Promise<ActionResult<{ orderId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
    }

    const admin = createAdminClient();

    // 1. Query existing purchase order
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, status, buyer_organization_id, created_by")
      .eq("id", orderId)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Purchase order not found." };
    }

    // 2. Query user profile for authorization
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    // Only buyer of the order (or admin) can edit
    const isOwner = profile?.organization_id === po.buyer_organization_id;
    const isAdmin = profile?.role === "admin";

    if (!isOwner && !isAdmin) {
      return { success: false, message: "Unauthorized: You can only edit purchase orders belonging to your organisation." };
    }

    // Only draft orders can be edited
    if (po.status !== "draft") {
      return {
        success: false,
        message: `Order cannot be edited in '${po.status}' status. Only 'draft' orders are editable.`,
      };
    }

    // 3. Verify supplier organisation
    const { data: supplierOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("id", input.supplierOrganizationId)
      .maybeSingle();

    if (!supplierOrg) {
      return { success: false, message: "Selected supplier organisation does not exist." };
    }

    // 4. Validate items
    if (!input.items || input.items.length === 0) {
      return { success: false, message: "Order must contain at least one line item." };
    }

    const sanitizedItems = input.items.map((itm) => {
      const qty = Number(itm.quantity);
      const price = Number(itm.unitPrice);
      return {
        itemName: itm.itemName.trim(),
        description: itm.description?.trim() || null,
        quantity: qty,
        unit: itm.unit.trim(),
        unitPrice: price,
        lineTotal: calculateLineTotal(qty, price),
      };
    });

    const newTotalAmount = calculateOrderTotal(sanitizedItems);

    const encodedDescription = encodePoDescription({
      deliveryAddress: input.deliveryAddress,
      notes: input.notes,
    });

    // 5. Update purchase order header
    const { error: updateErr } = await admin
      .from("purchase_orders")
      .update({
        supplier_organization_id: input.supplierOrganizationId,
        expected_delivery_date: input.expectedDeliveryDate || null,
        total_amount: newTotalAmount,
        description: encodedDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      return { success: false, message: `Failed to update purchase order: ${updateErr.message}` };
    }

    // 6. Replace order items: delete previous and insert updated
    await admin.from("order_items").delete().eq("purchase_order_id", orderId);

    const orderItemsToInsert = sanitizedItems.map((item) => ({
      purchase_order_id: orderId,
      item_name: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      created_at: new Date().toISOString(),
    }));

    await admin.from("order_items").insert(orderItemsToInsert);

    // 7. Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "PURCHASE_ORDER_UPDATED",
      entity_table: "purchase_orders",
      entity_id: orderId,
      details: {
        order_reference: po.order_reference,
        new_total_amount: newTotalAmount,
        items_count: sanitizedItems.length,
      },
      created_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/purchase-orders/${orderId}`);
    revalidatePath("/dashboard/purchase-orders");

    return { success: true, message: "Purchase order updated successfully!", data: { orderId } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update purchase order.";
    return { success: false, message: msg };
  }
}

/**
 * Server Action: Transition Purchase Order status.
 * Enforces business rules:
 * - Buyer: draft -> submitted, draft/submitted -> cancelled
 * - Supplier: submitted -> accepted, submitted -> rejected, accepted -> fulfilled
 * - Admin: any transition
 */
export async function updatePurchaseOrderStatusAction(
  orderId: string,
  newStatus: PurchaseOrderStatus,
  reason?: string
): Promise<ActionResult<{ newStatus: PurchaseOrderStatus }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "Authentication required." };
    }

    const admin = createAdminClient();

    // 1. Query order
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, order_reference, status, buyer_organization_id, supplier_organization_id")
      .eq("id", orderId)
      .maybeSingle();

    if (poErr || !po) {
      return { success: false, message: "Purchase order not found." };
    }

    // 2. Query user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const isBuyer = profile?.organization_id === po.buyer_organization_id;
    const isSupplier = profile?.organization_id === po.supplier_organization_id;
    const isAdmin = profile?.role === "admin";

    // 3. Business rule validation for status transitions
    const currentStatus = po.status as PurchaseOrderStatus;

    if (!isAdmin) {
      if (newStatus === "submitted") {
        if (!isBuyer || currentStatus !== "draft") {
          return { success: false, message: "Only the issuing buyer can submit a draft purchase order." };
        }
      } else if (newStatus === "accepted" || newStatus === "rejected") {
        if (!isSupplier || currentStatus !== "submitted") {
          return {
            success: false,
            message: `Only the designated supplier can ${newStatus} a submitted purchase order.`,
          };
        }
      } else if (newStatus === "fulfilled") {
        if (!isSupplier && !isAdmin) {
          return {
            success: false,
            message: "Only the supplier or administrator can mark an accepted order as fulfilled.",
          };
        }
        if (currentStatus !== "accepted") {
          return {
            success: false,
            message: "Only accepted orders can be marked as fulfilled.",
          };
        }
        // Strictly require confirmed delivery status in delivery_confirmations table (Step 6)
        const { data: confs } = await admin
          .from("delivery_confirmations")
          .select("id, status")
          .eq("purchase_order_id", orderId)
          .eq("status", "confirmed")
          .limit(1);

        if (!confs || confs.length === 0) {
          return {
            success: false,
            message: "Cannot mark order as fulfilled: Formal delivery confirmation by the buyer is required first.",
          };
        }
      } else if (newStatus === "cancelled") {
        if (!isBuyer && !isSupplier) {
          return { success: false, message: "Unauthorized to cancel this purchase order." };
        }
        if (currentStatus === "fulfilled") {
          return { success: false, message: "Fulfilled purchase orders cannot be cancelled." };
        }
      }
    }

    // 4. Update status in 'purchase_orders' table
    const { error: updateErr } = await admin
      .from("purchase_orders")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      return { success: false, message: `Failed to update status: ${updateErr.message}` };
    }

    // 5. Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "PURCHASE_ORDER_STATUS_CHANGED",
      entity_table: "purchase_orders",
      entity_id: orderId,
      details: {
        order_reference: po.order_reference,
        previous_status: currentStatus,
        new_status: newStatus,
        reason: reason || null,
      },
      created_at: new Date().toISOString(),
    });

    revalidatePath(`/dashboard/purchase-orders/${orderId}`);
    revalidatePath("/dashboard/purchase-orders");
    revalidatePath("/dashboard/buyer");
    revalidatePath("/dashboard/supplier");

    return {
      success: true,
      message: `Purchase order ${po.order_reference} status updated to '${newStatus}'.`,
      data: { newStatus },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update purchase order status.";
    return { success: false, message: msg };
  }
}
