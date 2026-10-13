{{-- A highlighted note. $tone: info (blue) or warning (amber); $text is escaped. --}}
@php($warn = ($tone ?? 'info') === 'warning')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td style="background-color:{{ $warn ? '#fff7e6' : '#f6f9fc' }}; border-left:4px solid {{ $warn ? '#c77700' : '#1865ac' }}; border-radius:4px; padding:12px 16px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:21px; color:#354960;">{{ $text }}</td></tr>
</table>
