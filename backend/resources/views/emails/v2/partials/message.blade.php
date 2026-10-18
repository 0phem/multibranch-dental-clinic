{{-- The Owner-approved wording (F1): plain-text paragraphs, escaped. --}}
@foreach ($paragraphs as $paragraph)
    <p style="margin:0 0 {{ $loop->last ? '18px' : '12px' }};">{{ $paragraph }}</p>
@endforeach
