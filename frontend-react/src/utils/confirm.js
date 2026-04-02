export function openConfirm(title, msg, onConfirm) {
  const event = new CustomEvent('show-confirm', { 
    detail: { title, msg, onConfirm } 
  });
  window.dispatchEvent(event);
}