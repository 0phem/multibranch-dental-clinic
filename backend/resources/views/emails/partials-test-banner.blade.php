@if (! empty($test))
    @include('emails.v2.partials.callout', ['tone' => 'warning', 'text' => 'Test email sent from Administration → Automations. It went only to you; the details may be examples.'])
@endif
