export function validateLetter({title, body, link = ''}) {
  if (typeof title !== 'string' || !title.trim() || title.length > 80 ||
      typeof body !== 'string' || !body.trim() || body.length > 1200) {
    throw Error('Escreva um título de até 80 caracteres e uma carta de até 1.200.');
  }
  if (link === '') return;
  try {
    if (typeof link !== 'string' || link.length > 1000) throw Error();
    const url = new URL(link);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error();
  } catch {
    throw Error('Use um link válido que comece com https:// ou http://.');
  }
}

export function letterLink(origin, title, body, link = '') {
  const letter = {id: crypto.randomUUID(), title: title.trim(), body: body.trim()};
  if (link.trim()) letter.link = link.trim();
  validateLetter(letter);
  return new URL('/#cartinha=' + encodeURIComponent(JSON.stringify(letter)), origin).href;
}

export function readLetter(hash) {
  if (!hash.startsWith('#cartinha=')) return null;
  if (hash.length > 30000) throw Error('O link desta cartinha está incompleto ou inválido.');
  try {
    const {id, title, body, link = ''} = JSON.parse(decodeURIComponent(hash.slice(10)));
    if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      throw Error('Identificador inválido.');
    }
    validateLetter({title, body, link});
    return {id, title: title.trim(), body: body.trim(), link};
  } catch {
    throw Error('O link desta cartinha está incompleto ou inválido.');
  }
}
