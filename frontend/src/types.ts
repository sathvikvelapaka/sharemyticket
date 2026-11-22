export interface Listing {
  id: string;
  ticket_id: string;
  seller_id: string;
  seller_name: string;
  event_id: string;
  event_name: string;
  event_category: string;
  event_date: string;
  event_city: string;
  venue_id: string;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  venue_lat: number;
  venue_lng: number;
  seat_category: string;
  quantity: number;
  original_price: number; // in paise
  resale_price: number; // in paise
  listing_status: string;
  show_time: string;
  expires_at: string;
  provider_name: string;
  discount_percentage: number;
  priceBreakdown: {
    originalPrice: number;
    resalePrice: number;
    savings: number;
    discountPercentage: number;
    platformFee: number;
    totalPayable: number;
  };
}

export interface BuyerRequirement {
  id: string;
  movie_title: string;
  preferred_city: string;
  preferred_venue_id?: string;
  venue_name?: string;
  preferred_date: string;
  preferred_time?: string;
  maximum_budget: number;
  quantity: number;
  requirement_status: string;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  listing_id: string;
  buyer_id: string;
  buyer_name?: string;
  seller_id: string;
  seller_name?: string;
  event_name: string;
  event_date: string;
  venue_name: string;
  venue_address?: string;
  resale_price: number;
  requested_quantity: number;
  request_status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  reservation_id?: string;
  reservation_status?: string;
  reservation_expires_at?: string;
  transaction_id?: string;
  transaction_status?: string;
}

export interface UserSession {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: 'buyer' | 'seller' | 'admin';
  };
  token: string;
}

export interface FraudAlert {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reason: string;
  review_status: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  transaction_id: string;
  raised_by: string;
  raised_by_name: string;
  dispute_category: string;
  description: string;
  dispute_status: string;
  admin_decision?: string;
  total_amount: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  outcome: string;
  details?: string;
  timestamp: string;
}
