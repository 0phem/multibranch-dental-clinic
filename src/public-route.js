export const publicViewFromHash=hash=>hash.startsWith('#accept-invitation')?'accept':hash==='#create-account'?'register':hash==='#verify-email'?'verify':hash==='#forgot-password'?'forgot':hash==='#sign-in'?'login':hash==='#privacy'?'privacy':hash==='#terms'?'terms':'home'
export const publicSections=new Set(['home','how-it-works','services','branches','features','faq','public-main'])
