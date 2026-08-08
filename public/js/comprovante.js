function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

async function renderComprovante() {
  const container = document.getElementById('comprovanteDoc');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    container.innerHTML = '<p>Comprovante não encontrado.</p>';
    return;
  }

  const res = await fetch(`/api/comprovantes/${id}`);
  if (res.status === 401) {
    container.innerHTML = '<p>Faça login no <a href="admin.html">painel administrativo</a> para visualizar este comprovante.</p>';
    return;
  }
  if (!res.ok) {
    container.innerHTML = '<p>Comprovante não encontrado.</p>';
    return;
  }

  const c = await res.json();
  document.title = `Comprovante - ${c.anunciante} - AG FM News`;

  const rows = c.insercoes
    .slice()
    .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))
    .map((i, idx) => `<tr><td>${idx + 1}</td><td>${formatDateBR(i.data)}</td><td>${escapeHtml(i.horario)}</td></tr>`)
    .join('');

  container.innerHTML = `
    <div class="comprovante-doc__header">
      <img src="assets/img/logo.png" alt="AG FM News">
      <div>
        <h1>AG FM News</h1>
        <p>O tempo todo em todo lugar! — União dos Palmares/AL — mitonorimm@hotmail.com</p>
      </div>
    </div>

    <h2>Comprovante de Irradiação</h2>

    <dl class="comprovante-doc__grid">
      <div><dt>Anunciante</dt><dd>${escapeHtml(c.anunciante)}</dd></div>
      <div><dt>Comercial / Campanha</dt><dd>${escapeHtml(c.comercial)}</dd></div>
      <div><dt>Período</dt><dd>${formatDateBR(c.data_inicio)} a ${formatDateBR(c.data_fim)}</dd></div>
      <div><dt>Emissão</dt><dd>${new Date(c.created_at.replace(' ', 'T')).toLocaleDateString('pt-BR')}</dd></div>
    </dl>

    <table class="comprovante-table">
      <thead><tr><th>#</th><th>Data</th><th>Horário</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="comprovante-doc__total">Total de inserções: ${c.insercoes.length}</p>

    <p class="comprovante-doc__declaracao">
      A Rádio AG FM News declara, para os devidos fins, que o material publicitário acima identificado foi
      efetivamente irradiado nas datas e horários listados, dentro do período de veiculação informado,
      conforme controle interno de programação da emissora.
    </p>

    <div class="comprovante-doc__signature">
      <div class="line">
        <strong>${escapeHtml(c.responsavel_nome)}</strong>
        <span>${escapeHtml(c.responsavel_cargo)} — AG FM News</span>
      </div>
    </div>

    <div class="comprovante-doc__footer">
      AG FM News — Comprovante gerado eletronicamente em ${new Date().toLocaleDateString('pt-BR')}
    </div>
  `;
}

document.getElementById('btnPrint')?.addEventListener('click', () => window.print());

renderComprovante();
