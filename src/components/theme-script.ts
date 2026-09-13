// Sayfa boyanmadan önce kayıtlı temayı uygular (renk sıçramasını önler).
export const THEME_SCRIPT = `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
