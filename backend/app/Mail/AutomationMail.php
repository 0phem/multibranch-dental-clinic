<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Shared base of the scheduled-automation emails (design A v2 layout with a plain-text part). A test copy sent from
 * Administration → Automations carries "[Test]" in the subject and a banner, and goes only to the signed-in Owner.
 */
abstract class AutomationMail extends Mailable
{
    use Queueable, SerializesModels;

    public bool $test = false;

    public function asTest(): static
    {
        $this->test = true;

        return $this;
    }

    /** An unsaved edit (subject, body) rendered by the Owner's preview instead of the saved wording. */
    public ?array $draft = null;

    public function withDraft(?array $draft): static
    {
        $this->draft = $draft;

        return $this;
    }

    protected function subjectLine(string $subject): string
    {
        return ($this->test ? '[Test] ' : '').$subject;
    }

    /**
     * The Owner-approved wording of this email (F1, R2-09) with its placeholders filled in.
     *
     * @return array{subject:string, paragraphs:list<string>}
     */
    protected function wording(string $key, array $vars): array
    {
        $w = \App\Services\Automations\MessageTemplates::render($key, $vars, $this->draft);
        $w['subject'] = $this->subjectLine($w['subject'].' - '.\App\Support\Brand::name());

        return $w;
    }
}
