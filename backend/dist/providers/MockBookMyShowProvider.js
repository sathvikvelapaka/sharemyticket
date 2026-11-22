"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProvider = exports.MockBookMyShowProvider = void 0;
const uuid_1 = require("uuid");
class MockBookMyShowProvider {
    providerId = 'provider-bms';
    providerName = 'BookMyShow (Simulated Adapter)';
    // In-memory registry of transfers within the provider simulator
    transfers = new Map();
    async verifyTicket(bookingRef, eventId, eventDate) {
        const cleanRef = bookingRef.trim().toUpperCase();
        // Simulation rules:
        // If booking reference starts with "INVALID", it fails verification
        if (cleanRef.startsWith('INVALID')) {
            return {
                valid: false,
                eligible: false,
                reason: 'Ticket booking reference not found in BookMyShow simulated database.',
                providerTicketReference: cleanRef,
            };
        }
        // If starts with "NONTRANS", it is valid but not eligible for transfer
        if (cleanRef.startsWith('NONTRANS')) {
            return {
                valid: true,
                eligible: false,
                reason: 'This event tier does not allow ticket transfers according to organiser policy.',
                providerTicketReference: cleanRef,
            };
        }
        return {
            valid: true,
            eligible: true,
            providerTicketReference: `BMS-VERIFIED-${cleanRef}`,
            metadata: {
                providerShowtimeVerified: true,
                cinemaPartner: 'PVR INOX Limited',
                simulationMode: true,
            },
        };
    }
    async checkTransferEligibility(ticketId) {
        return {
            eligible: true,
            policyNote: 'Eligible for official transfer up to 2 hours before scheduled showtime.',
        };
    }
    async lockTicket(providerRef) {
        // Simulates provider holding the original QR from being scanned at gate during transfer window
        return true;
    }
    async initiateTransfer(ticketId, recipientName, recipientEmail, recipientPhone) {
        const transferRef = `BMS-XFER-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
        const state = {
            reference: transferRef,
            ticketId,
            recipientName,
            recipientEmail,
            recipientPhone,
            status: 'awaiting_buyer_acceptance',
            initiatedAt: new Date().toISOString(),
        };
        this.transfers.set(transferRef, state);
        return {
            success: true,
            providerTransferReference: transferRef,
            status: 'awaiting_buyer_acceptance',
            invitationUrl: `https://bookmyshow.example.com/transfer/accept?ref=${transferRef}`,
            message: `Official transfer initiated to ${recipientEmail}. Recipient must accept to complete transfer.`,
        };
    }
    async getTransferStatus(providerTransferReference) {
        const existing = this.transfers.get(providerTransferReference);
        if (!existing) {
            return {
                transferReference: providerTransferReference,
                status: 'failed',
                failureReason: 'Transfer reference not found in provider system.',
            };
        }
        return {
            transferReference: existing.reference,
            status: existing.status,
            confirmedAt: existing.confirmedAt,
            failureReason: existing.failureReason,
        };
    }
    async acceptTransfer(providerTransferReference, buyerEmail) {
        let existing = this.transfers.get(providerTransferReference);
        if (!existing) {
            // Auto-register and confirm seamlessly so demo transactions always succeed
            existing = {
                reference: providerTransferReference,
                ticketId: 'simulated-ticket-id',
                recipientName: 'Verified Buyer',
                recipientEmail: buyerEmail,
                recipientPhone: '+919876543210',
                status: 'provider_confirmed',
                initiatedAt: new Date().toISOString(),
                confirmedAt: new Date().toISOString(),
            };
            this.transfers.set(providerTransferReference, existing);
        }
        else {
            existing.status = 'provider_confirmed';
            existing.confirmedAt = new Date().toISOString();
        }
        return {
            transferReference: existing.reference,
            status: 'provider_confirmed',
            confirmedAt: existing.confirmedAt,
        };
    }
    async failTransfer(providerTransferReference, reason) {
        const existing = this.transfers.get(providerTransferReference);
        if (!existing) {
            throw new Error('Provider transfer reference not found');
        }
        existing.status = 'failed';
        existing.failureReason = reason;
        this.transfers.set(providerTransferReference, existing);
        return {
            transferReference: existing.reference,
            status: 'failed',
            failureReason: reason,
        };
    }
    async cancelTransfer(providerTransferReference) {
        const existing = this.transfers.get(providerTransferReference);
        if (existing) {
            existing.status = 'cancelled';
            return true;
        }
        return false;
    }
}
exports.MockBookMyShowProvider = MockBookMyShowProvider;
exports.defaultProvider = new MockBookMyShowProvider();
