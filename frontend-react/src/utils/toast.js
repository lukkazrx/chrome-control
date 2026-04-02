export function toast(msg, type = 'ok') {
  // Cria um evento customizado contendo a mensagem e o tipo (ok, error, warn)
  const event = new CustomEvent('show-toast', { detail: { msg, type } });
  window.dispatchEvent(event);
}