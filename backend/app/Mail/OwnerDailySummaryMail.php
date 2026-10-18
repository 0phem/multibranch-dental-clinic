<?php

namespace App\Mail;

use App\Models\User;
use App\Services\Automations\OwnerSummaryData;
use App\Support\Brand;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A6: the day's numbers per branch for the Owner. Numbers only: no patient names, messages or clinical data. */
class OwnerDailySummaryMail extends AutomationMail
{
    public function __construct(public User $owner, public string $date) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $this->date, ClinicClock::TIMEZONE);

        return $this->wording('owner_daily_summary', ['first_name' => $this->owner->person?->first_name ?: 'there', 'date' => $day->format('l, F j, Y')]);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.owner-summary', text: 'emails.owner-summary-text', with: OwnerSummaryData::forDate($this->date) + [
            'day' => CarbonImmutable::createFromFormat('!Y-m-d', $this->date, ClinicClock::TIMEZONE), 'test' => $this->test,
            'subjectLine' => $this->envelope()->subject, 'firstName' => $this->owner->person?->first_name ?: 'there', 'reportsUrl' => Brand::pageUrl('reports'), 'paragraphs' => $this->w()['paragraphs'],
        ]);
    }
}
