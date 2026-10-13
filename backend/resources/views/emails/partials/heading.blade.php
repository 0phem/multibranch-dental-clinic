{{-- Page headline, with an optional small eyebrow line above it. --}}
@if (! empty($eyebrow))
<p class="t-muted" style="margin:0 0 6px; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5b6b7f;">{{ $eyebrow }}</p>
@endif
<h1 class="t-ink" style="margin:0 0 18px; font-size:24px; line-height:32px; font-weight:700; color:#182b41;">{{ $text }}</h1>
