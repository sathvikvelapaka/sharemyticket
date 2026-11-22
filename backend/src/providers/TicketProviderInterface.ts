export interface ProviderVerificationResult {
  valid: boolean;
  eligible: boolean;
  reason?: string;
  providerTicketReference: string;
  metadata?: Record<string, any>;
}

export interface ProviderTransferInitiationResult {
  success: boolean;
  providerTransferReference: string;
  status: 'initiated' | 'awaiting_buyer_acceptance' | 'failed';
  invitationUrl?: string;
  message?: string;
}

export interface ProviderTransferStatusResult {
  transferReference: string;
  status: 'initiated' | 'awaiting_buyer_acceptance' | 'provider_confirmed' | 'failed' | 'cancelled';
  confirmedAt?: string;
  failureReason?: string;
}

export interface TicketProviderInterface {
  providerId: string;
  providerName: string;

  verifyTicket(bookingRef: string, eventId: string, eventDate: string): Promise<ProviderVerificationResult>;
  checkTransferEligibility(ticketId: string): Promise<{ eligible: boolean; policyNote: string }>;
  lockTicket(providerRef: string): Promise<boolean>;
  initiateTransfer(ticketId: string, recipientName: string, recipientEmail: string, recipientPhone: string): Promise<ProviderTransferInitiationResult>;
  getTransferStatus(providerTransferReference: string): Promise<ProviderTransferStatusResult>;
  acceptTransfer(providerTransferReference: string, buyerEmail: string): Promise<ProviderTransferStatusResult>;
  failTransfer(providerTransferReference: string, reason: string): Promise<ProviderTransferStatusResult>;
  cancelTransfer(providerTransferReference: string): Promise<boolean>;
}
