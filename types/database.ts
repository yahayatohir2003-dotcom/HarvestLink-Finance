/**
 * HarvestLink Finance - Database Schema Types
 *
 * Generated directly from the 12 existing tables in your Supabase database schema.
 * All table and column names correspond 100% exactly to the live PostgreSQL schema.
 * DO NOT manually rename or mutate table/column definitions.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          organization_type: string;
          registration_number: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          organization_type: string;
          registration_number?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          organization_type?: string;
          registration_number?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: "supplier" | "buyer" | "financier" | "admin" | string;
          organization_id: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: "supplier" | "buyer" | "financier" | "admin" | string;
          organization_id?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: "supplier" | "buyer" | "financier" | "admin" | string;
          organization_id?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          order_reference: string;
          buyer_organization_id: string;
          supplier_organization_id: string | null;
          created_by: string;
          order_date: string;
          expected_delivery_date: string | null;
          currency: string;
          total_amount: number;
          status: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_reference: string;
          buyer_organization_id: string;
          supplier_organization_id?: string | null;
          created_by: string;
          order_date?: string;
          expected_delivery_date?: string | null;
          currency?: string;
          total_amount?: number;
          status?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_reference?: string;
          buyer_organization_id?: string;
          supplier_organization_id?: string | null;
          created_by?: string;
          order_date?: string;
          expected_delivery_date?: string | null;
          currency?: string;
          total_amount?: number;
          status?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          item_name: string;
          description: string | null;
          quantity: number;
          unit: string;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          item_name: string;
          description?: string | null;
          quantity: number;
          unit: string;
          unit_price: number;
          line_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          item_name?: string;
          description?: string | null;
          quantity?: number;
          unit?: string;
          unit_price?: number;
          line_total?: number;
          created_at?: string;
        };
      };
      financing_requests: {
        Row: {
          id: string;
          purchase_order_id: string;
          requested_by: string;
          requested_amount: number;
          purpose: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          requested_by: string;
          requested_amount: number;
          purpose: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          requested_by?: string;
          requested_amount?: number;
          purpose?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      financing_reviews: {
        Row: {
          id: string;
          financing_request_id: string;
          reviewer_id: string;
          decision: string;
          comments: string | null;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          financing_request_id: string;
          reviewer_id: string;
          decision: string;
          comments?: string | null;
          reviewed_at?: string;
        };
        Update: {
          id?: string;
          financing_request_id?: string;
          reviewer_id?: string;
          decision?: string;
          comments?: string | null;
          reviewed_at?: string;
        };
      };
      fulfilment_milestones: {
        Row: {
          id: string;
          purchase_order_id: string;
          milestone_name: string;
          status: string;
          notes: string | null;
          target_date: string | null;
          completed_at: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          milestone_name: string;
          status?: string;
          notes?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          milestone_name?: string;
          status?: string;
          notes?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
      };
      delivery_confirmations: {
        Row: {
          id: string;
          purchase_order_id: string;
          confirmed_by: string;
          received_by_name: string | null;
          delivery_date: string;
          quantity_received: number | null;
          condition_notes: string | null;
          evidence_document_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          confirmed_by: string;
          received_by_name?: string | null;
          delivery_date?: string;
          quantity_received?: number | null;
          condition_notes?: string | null;
          evidence_document_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          confirmed_by?: string;
          received_by_name?: string | null;
          delivery_date?: string;
          quantity_received?: number | null;
          condition_notes?: string | null;
          evidence_document_id?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          purchase_order_id: string | null;
          financing_request_id: string | null;
          uploaded_by: string;
          document_type: string;
          original_filename: string;
          storage_path: string;
          mime_type: string | null;
          file_size_bytes: number | null;
          verification_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id?: string | null;
          financing_request_id?: string | null;
          uploaded_by: string;
          document_type: string;
          original_filename: string;
          storage_path: string;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          verification_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string | null;
          financing_request_id?: string | null;
          uploaded_by?: string;
          document_type?: string;
          original_filename?: string;
          storage_path?: string;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          verification_status?: string;
          created_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          purchase_order_id: string;
          invoice_number: string;
          amount: number;
          issue_date: string;
          due_date: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          invoice_number: string;
          amount: number;
          issue_date?: string;
          due_date?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          invoice_number?: string;
          amount?: number;
          issue_date?: string;
          due_date?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      settlements: {
        Row: {
          id: string;
          purchase_order_id: string;
          invoice_id: string | null;
          amount: number;
          status: string;
          payment_reference: string | null;
          is_simulated: boolean;
          notes: string | null;
          recorded_by: string | null;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          invoice_id?: string | null;
          amount: number;
          status?: string;
          payment_reference?: string | null;
          is_simulated?: boolean;
          notes?: string | null;
          recorded_by?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          invoice_id?: string | null;
          amount?: number;
          status?: string;
          payment_reference?: string | null;
          is_simulated?: boolean;
          notes?: string | null;
          recorded_by?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_table: string;
          entity_id?: string | null;
          details: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_table?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
      };
    };
  };
}
