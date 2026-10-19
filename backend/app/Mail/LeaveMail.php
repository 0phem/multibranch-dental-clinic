<?php

namespace App\Mail;

use App\Models\LeaveRequest;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * M15: a leave request to an approver ("leave_requested") or the decision back to the requester ("leave_decided"), in the
 * Owner-approved wording. Never the private note and never the type of leave: only who, the dates and the status.
 */
class LeaveMail extends AutomationMail
{
    public function __construct(public LeaveRequest $leave, public string $purpose, public ?string $recipientName = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $l = $this->leave;

        return $this->wording($this->purpose, ['first_name' => $this->recipientName ?: 'there', 'name' => $l->requester?->person?->fullName() ?? 'A team member',
            'from' => self::moment($l->starts_at), 'to' => self::moment($l->ends_at), 'status' => strtolower($l->status)]);
    }

    public static function moment($instant): string
    {
        $local = ClinicClock::local($instant);

        return $local->format('H:i') === '00:00' ? $local->format('D, M j') : $local->format('D, M j, g:i A');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.leave', text: 'emails.leave-text', with: [
            'subjectLine' => $this->envelope()->subject, 'paragraphs' => $this->w()['paragraphs'], 'name' => $this->recipientName ?: 'there', 'test' => $this->test,
            'link' => rtrim((string) config('app.frontend_url'), '/').'/#sign-in',
        ]);
    }
}
