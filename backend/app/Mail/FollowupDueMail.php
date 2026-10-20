<?php

namespace App\Mail;

use App\Models\FollowupTask;
use App\Support\Brand;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** M20: "time to book your follow-up visit". No reason, treatment, service or clinical detail. */
class FollowupDueMail extends AutomationMail
{
    public function __construct(public FollowupTask $task) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        return $this->wording('followup_due', ['first_name' => $this->task->patient?->person?->first_name ?: 'there', 'branch' => $this->task->branch?->name ?? 'the clinic',
            'date' => \Carbon\CarbonImmutable::parse($this->task->dueOn())->format('F j')]);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.followup-due', text: 'emails.followup-due-text', with: [
            'branch' => $this->task->branch, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $this->task->patient?->person?->first_name ?: 'there', 'bookUrl' => Brand::pageUrl('book'), 'paragraphs' => $this->w()['paragraphs'],
        ]);
    }
}
