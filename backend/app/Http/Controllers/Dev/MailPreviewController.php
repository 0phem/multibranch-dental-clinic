<?php

namespace App\Http\Controllers\Dev;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Mail\ClinicTestMail;
use App\Mail\EmployeeInvitationMail;
use App\Mail\OneTimeCodeMail;
use App\Mail\SecurityNoticeMail;
use App\Models\EmailVerificationOtp;
use App\Models\Person;
use App\Models\User;
use Illuminate\Mail\Mailable;

/**
 * DEV ONLY (routes/web.php registers it only when APP_ENV=local): renders each account email with made-up sample data so the
 * design can be checked without sending anything. No database record is read or written; nothing is sent.
 */
class MailPreviewController extends Controller
{
    private function samples(): array
    {
        $invitee = new User(['email' => 'new.staff@example.test', 'role' => Role::Staff]);
        $invitee->setRelation('person', new Person(['first_name' => 'Alex']));
        $when = 'October 13, 2026 2:05 PM';

        return [
            'verification-code' => fn () => new OneTimeCodeMail('482913', EmailVerificationOtp::REGISTRATION, 'Maria'),
            'password-reset-code' => fn () => new OneTimeCodeMail('730254', EmailVerificationOtp::PASSWORD_RESET, 'Maria'),
            'email-change-code' => fn () => new OneTimeCodeMail('195847', EmailVerificationOtp::EMAIL_CHANGE, 'Maria'),
            'registration-attempt' => fn () => new SecurityNoticeMail('registration_attempt', 'Maria'),
            'registration-attempt-record' => fn () => new SecurityNoticeMail('registration_attempt_record', 'Maria'),
            'password-changed' => fn () => new SecurityNoticeMail('password_changed', 'Maria', $when),
            'email-changed' => fn () => new SecurityNoticeMail('email_changed', 'Maria', $when, SecurityNoticeMail::mask('maria.new@example.test')),
            'employee-invitation' => fn () => new EmployeeInvitationMail($invitee, rtrim((string) config('app.frontend_url'), '/').'/#accept-invitation?email=new.staff%40example.test&token=SAMPLE-TOKEN', 72),
            'message-alert' => fn () => new \App\Mail\MessageAlertMail('Maria'),
            'smtp-test' => fn () => new ClinicTestMail(),
        ];
    }

    public function index()
    {
        $rows = collect($this->samples())->map(function ($make, $name) {
            $mail = $make();
            $html = $mail->render();

            return '<tr><td style="padding:6px 12px;"><a href="/dev/mail/'.$name.'">'.e($name).'</a></td><td style="padding:6px 12px;">'.e($mail->envelope()->subject)
                .'</td><td style="padding:6px 12px;">'.number_format(strlen($html) / 1024, 1).' KB</td><td style="padding:6px 12px;">'
                .($this->text($mail) !== null ? '<a href="/dev/mail/'.$name.'?format=text">plain text</a>' : 'none').'</td></tr>';
        })->implode('');

        return response('<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:Arial,sans-serif;padding:24px;">'
            .'<h1>Email previews (development only)</h1><p>Sample data only. Nothing is sent and no record is read.</p>'
            .'<table border="1" cellspacing="0" style="border-collapse:collapse;"><tr><th>Template</th><th>Subject</th><th>HTML size</th><th>Text part</th></tr>'.$rows.'</table></body>');
    }

    public function show(string $template)
    {
        $make = $this->samples()[$template] ?? abort(404);
        $mail = $make();
        if (request('format') === 'text') {
            return response($this->text($mail) ?? abort(404), 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
        }

        return response($mail->render());
    }

    private function text(Mailable $mail): ?string
    {
        $content = $mail->content();
        if (! $content->text) return null;

        return view($content->text, array_merge($mail->buildViewData(), $content->with))->render();
    }
}
