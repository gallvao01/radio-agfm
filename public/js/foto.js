// Foto direto do telefone para o próprio site, usada pelo app e pelo painel.
// Reduz no aparelho para subir rápido e guarda no banco do site, sem serviço de fora.
(() => {
  'use strict';

  const LARGURAS = [1600, 1280, 1024, 800];
  const QUALIDADES = [0.85, 0.75, 0.65];
  const MAX_BYTES = 900 * 1024;
  const MENOR_LADO = 300;
  const TEMPO_MAXIMO = 90000;

  // Lê como data: porque a política de segurança do site bloqueia imagens blob:.
  function abrir(arquivo) {
    return new Promise((ok, falha) => {
      const leitor = new FileReader();
      leitor.onerror = () => falha(new Error('Não consegui ler essa foto. Tente de novo.'));
      leitor.onload = () => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => falha(new Error('Esse formato de foto não abriu neste telefone. Tente uma foto JPG ou um print dela.'));
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  const paraBlob = (canvas, qualidade) => new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));

  async function reduzir(img) {
    if (Math.min(img.naturalWidth, img.naturalHeight) < MENOR_LADO) {
      throw new Error('Essa foto é pequena demais para o site. Use a original.');
    }
    const maior = Math.max(img.naturalWidth, img.naturalHeight);
    for (const lado of LARGURAS) {
      const escala = Math.min(1, lado / maior);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * escala);
      canvas.height = Math.round(img.naturalHeight * escala);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG transparente não pode virar fundo preto no JPG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const qualidade of QUALIDADES) {
        const blob = await paraBlob(canvas, qualidade);
        if (blob && blob.size <= MAX_BYTES) return blob;
      }
    }
    throw new Error('Não consegui preparar essa foto. Tente outra.');
  }

  async function enviar(arquivo) {
    const blob = await reduzir(await abrir(arquivo));
    // Feito à mão porque AbortSignal.timeout não existe em iPhones mais antigos.
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), TEMPO_MAXIMO);
    let res;
    try {
      res = await fetch('/api/fotos', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
        signal: controle.signal
      });
    } catch {
      throw new Error('A internet falhou ao enviar a foto. Tente de novo.');
    } finally {
      clearTimeout(limite);
    }
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      const erro = new Error(dados.error || `O site não aceitou a foto (${res.status}).`);
      erro.status = res.status;
      throw erro;
    }
    return dados.url;
  }

  window.fotoDoTelefone = { enviar };
})();
