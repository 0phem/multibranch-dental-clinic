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

    protected function subjectLine(string $subject): string
    {
        return ($this->test ? '[Test] ' : '').$subject;
    }
}
