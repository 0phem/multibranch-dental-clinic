<?php

namespace App\Services\Notifications;

use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Invoice;
use App\Models\Receipt;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Brand;
use App\Support\ClinicClock;
use Illuminate\Support\Facades\DB;

/**
 * Notifications (identity-specific, CLAUDE.md "Messages != Notifications"): written ONLY when a real server event happens, inside
 * the same transaction, at most once per event (dedupe key). They never carry message text or clinical detail. A failure here is
 * reported and never blocks the booking, payment or message that caused it.
 */
class NotificationCenter
{
    private const APPOINTMENT_KINDS = ['appointment_confirmation' => ['appointment_booked', 'Appointment confirmed'],
        'appointment_rescheduled' => ['appointment_rescheduled', 'Appointment moved'], 'appointment_cancelled' => ['appointment_cancelled', 'Appointment cancelled']];

    public function appointment(Appointment $appointment, string $purpose): void
    {
        [$kind, $title] = self::APPOINTMENT_KINDS[$purpose] ?? [null, null];
        $user = $appointment->patient?->user;
        if (! $kind || ! $user) return;
        $appointment->loadMissing(['service', 'branch']);
        $when = ClinicClock::local($appointment->starts_at)->format('M j, g:i A');
        $this->write($user, $kind, $title, implode(' · ', array_filter([$appointment->service?->name, $when, $appointment->branch?->name])),
            'visits', $appointment->public_id, "$purpose:{$appointment->public_id}:r{$appointment->revision}");
    }

    public function invoiceIssued(Invoice $invoice): void
    {
        $user = $invoice->patient?->user;
        if (! $user) return;
        $this->write($user, 'invoice_issued', "New invoice {$invoice->invoice_number}", 'Amount due '.Brand::money($invoice->balance()), 'billing', $invoice->public_id,
            "invoice_issued:{$invoice->public_id}");
    }

    public function paymentReceived(Invoice $invoice, Receipt $receipt): void
    {
        $user = $invoice->patient?->user;
        if (! $user) return;
        $this->write($user, 'payment_received', 'Payment received', Brand::money($receipt->amount)." for {$invoice->invoice_number} · Receipt {$receipt->receipt_number}",
            'billing', $invoice->public_id, "payment_received:{$receipt->public_id}");
    }

    /** A new message from the clinic: who and where, never what (the text stays in Messages). */
    public function messageReceived(Conversation $conversation, int $messageId): void
    {
        $user = $conversation->patient?->user;
        if (! $user) return;
        $this->write($user, 'message_received', 'New message from the clinic', ($conversation->branch?->name ?? 'The clinic').' front desk replied',
            'messages', $conversation->public_id, "message_received:{$messageId}");
    }

    private function write(User $user, string $kind, string $title, ?string $body, ?string $page, ?string $targetId, string $dedupe): void
    {
        try {
            DB::transaction(fn () => UserNotification::firstOrCreate(['dedupe_key' => $dedupe], [
                'user_id' => $user->id, 'kind' => $kind, 'title' => mb_substr($title, 0, 160), 'body' => $body ? mb_substr($body, 0, 300) : null,
                'target_page' => $page, 'target_id' => $targetId, 'created_at' => now(),
            ]));
        } catch (\Throwable $e) {
            report($e); // in a savepoint: the event that caused it still commits
        }
    }
}
