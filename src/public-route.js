export const publicViewFromHash=hash=>hash==='#create-account'?'register':hash==='#verify-email'?'verify':hash==='#sign-in'?'login':'home'
export const publicSections=new Set(['home','about','features','portal','contact','public-main'])
