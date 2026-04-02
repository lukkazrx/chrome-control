// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 

// Helper de label de cargo
function cargoLabel(p) {
  if (p.tipo === 'Matéria')     return `Prof. ${p.materia}`;
  if (p.tipo === 'Titular')     return 'Prof. Titular';
  if (p.tipo === 'Coordenador') return 'Coordenador';
  if (p.tipo === 'Orientador')  return 'Orientador';
  if (p.tipo === 'Outro')       return p.materia || 'Outro';
  return p.tipo || '—';
}

// Limpa colchetes de turmas múltiplas
function formatarTurmas(turmaStr) {
  if (!turmaStr || turmaStr === '—') return '—';
  try {
    const arr = JSON.parse(turmaStr);
    return Array.isArray(arr) ? arr.join(', ') : turmaStr;
  } catch {
    return turmaStr; 
  }
}

// Helper: Formata o Chromebook para exibir o Nº no PDF
function formatarCBParaPDF(chromebooks) {
  if (!chromebooks || chromebooks.length === 0) return '—';
  return chromebooks.map(c => c.numero ? `Nº ${c.numero} (${c.id})` : c.id).join(', ');
}

// NOVO Helper: Formata a string/array de acessórios para o PDF
function formatarAcessoriosParaPDF(acessorios) {
  if (!acessorios) return '—';
  if (Array.isArray(acessorios) && acessorios.length > 0) return acessorios.join(', ');
  if (typeof acessorios === 'string' && acessorios !== '[]') {
    try { return JSON.parse(acessorios).join(', ') || '—'; } 
    catch { return acessorios; }
  }
  return '—';
}

// -----------------------------------------------------------------------------
// CONSTANTES DE DESIGN GLOBAIS
// -----------------------------------------------------------------------------
const COR_HEADER_BG = [26,  29,  39];
const COR_ACCENT    = [79, 142, 247];
const COR_ACCENT2   = [56, 217, 169];
const COR_WARN      = [247,201, 79];
const COR_DANGER    = [255, 94, 94];
const COR_SURFACE   = [245, 247, 250];
const COR_BORDER    = [226, 232, 240];
const COR_TEXT      = [30,  40,  60];
const COR_MUTED     = [100, 116, 139];
const COR_WHITE     = [255, 255, 255];

// -----------------------------------------------------------------------------
// RELATÓRIO 1: DASHBOARD GERAL
// -----------------------------------------------------------------------------
export function gerarRelatorioPDF(state) {
  const hoje      = new Date();
  const dataHoje  = hoje.toLocaleDateString('pt-BR');
  const horaAgora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nomeArq   = `relatorio-chromebooks-${hoje.toISOString().slice(0,10)}.pdf`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  let y = 0;

  // Header do PDF
  doc.setFillColor(...COR_HEADER_BG);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_ACCENT);
  doc.text('Chrome', 14, 12);
  const wChrome = doc.getTextWidth('Chrome');
  doc.setTextColor(...COR_ACCENT2);
  doc.text('Control', 14 + wChrome, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COR_MUTED);
  doc.text('Sistema de Gestão de Empréstimos de Equipamentos', 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(`Gerado em ${dataHoje} às ${horaAgora}`, W - 14, 12, { align: 'right' });

  y = 35;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Relatório do Dia — ${dataHoje}`, 14, y);
  y += 8;

  // Cálculos para os Cards
  const totalCBs    = state.chromebooks.length;
  const disponiveis = state.chromebooks.filter(c => c.status === 'disponivel').length;
  const emprestados = state.chromebooks.filter(c => c.status === 'emprestado').length;
  const ativos      = state.emprestimos.length;
  const empHoje     = state.historico.filter(h => h.dataRetirada?.startsWith(dataHoje)).length;
  const devHoje     = state.historico.filter(h => h.dataDevolucao?.startsWith(dataHoje)).length;

  const cards = [
    { label: 'Total de Equipamentos', valor: totalCBs,     cor: COR_ACCENT  },
    { label: 'Disponíveis',          valor: disponiveis, cor: COR_ACCENT2 },
    { label: 'Em Empréstimo',        valor: emprestados, cor: COR_WARN    },
    { label: 'Empréstimos Hoje',     valor: empHoje,     cor: COR_ACCENT  },
    { label: 'Devoluções Hoje',      valor: devHoje,     cor: COR_ACCENT2 },
    { label: 'Em Aberto Agora',      valor: ativos,      cor: ativos > 0 ? COR_DANGER : COR_ACCENT2 },
  ];

  const cardW = (W - 28 - 10) / 3;
  const cardH = 18;
  let cx = 14, cy = y;

  cards.forEach((c, i) => {
    if (i === 3) { cx = 14; cy += cardH + 4; }
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'S');
    doc.setFillColor(...c.cor);
    doc.roundedRect(cx, cy, 3, cardH, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR_MUTED);
    doc.text(c.label.toUpperCase(), cx + 7, cy + 6);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.cor);
    doc.text(String(c.valor), cx + 7, cy + 14);
    cx += cardW + 5;
  });

  y = cy + cardH + 10;

  // Tabela: Empréstimos em aberto
  doc.setFillColor(...COR_ACCENT);
  doc.rect(14, y, 3, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text('Empréstimos em Aberto', 20, y + 5.5);
  y += 12;

  if (state.emprestimos.length === 0) {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COR_MUTED);
    doc.text('Nenhum empréstimo em aberto no momento.', W / 2, y + 7.5, { align: 'center' });
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      // NOVO: Adicionada a coluna de Acessórios
      head: [['Professor', 'Turma', 'Equipamentos', 'Acessórios', 'Retirada em', 'Observação']],
      body: state.emprestimos.map(e => [
        e.professorNome, 
        formatarTurmas(e.professorTurma),
        formatarCBParaPDF(e.chromebooks), 
        formatarAcessoriosParaPDF(e.acessorios), // NOVO
        e.dataRetirada, 
        e.obs || '—',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: COR_TEXT, lineColor: COR_BORDER, lineWidth: 0.3 },
      headStyles: { fillColor: COR_HEADER_BG, textColor: COR_WHITE, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COR_SURFACE },
      // Ajuste das larguras para caber a nova coluna (removi o "Tipo/Matéria" para não poluir muito no retrato)
      columnStyles: { 0:{cellWidth:36}, 1:{cellWidth:14}, 2:{cellWidth:34}, 3:{cellWidth:25}, 4:{cellWidth:24}, 5:{cellWidth:'auto'} },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Tabela: Movimentações do dia
  const movDia = state.historico.filter(h =>
    h.dataRetirada?.startsWith(dataHoje) || h.dataDevolucao?.startsWith(dataHoje)
  );

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(...COR_ACCENT2);
  doc.rect(14, y, 3, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Movimentações de Hoje (${dataHoje})`, 20, y + 5.5);
  y += 12;

  if (movDia.length === 0) {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COR_MUTED);
    doc.text('Nenhuma movimentação registada hoje.', W / 2, y + 7.5, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: y,
      // NOVO: Adicionada a coluna de Acessórios
      head: [['Professor', 'Turma', 'Equipamentos', 'Acessórios', 'Retirada', 'Devolução', 'Status']],
      body: movDia.map(h => [
        h.professorNome, 
        formatarTurmas(h.professorTurma),
        formatarCBParaPDF(h.chromebooks), 
        formatarAcessoriosParaPDF(h.acessorios), // NOVO
        h.dataRetirada, h.dataDevolucao || '—',
        h.status === 'devolvido' ? 'Devolvido' : 'Em aberto',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: COR_TEXT, lineColor: COR_BORDER, lineWidth: 0.3 },
      headStyles: { fillColor: COR_HEADER_BG, textColor: COR_WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: COR_SURFACE },
      // Ajuste fino das larguras para encaixar as colunas no layout retrato
      columnStyles: { 0:{cellWidth:30}, 1:{cellWidth:14}, 2:{cellWidth:32}, 3:{cellWidth:22}, 4:{cellWidth:24}, 5:{cellWidth:24}, 6:{cellWidth:'auto'} },
      didDrawCell(data) {
        if (data.section === 'body' && data.column.index === 6) {
          const cor = data.cell.raw === 'Devolvido' ? COR_ACCENT2 : COR_WARN;
          doc.setTextColor(...cor);
          doc.setFont('helvetica', 'bold');
          doc.text(data.cell.raw, data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2 + 1);
        }
      },
    });
  }

  // Rodapé em todas as páginas
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pY = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pY - 3, W - 14, pY - 3);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR_MUTED);
    doc.text('ChromeControl — Sistema de Gestão de Empréstimos', 14, pY);
    doc.text(`Página ${i} de ${pageCount}`, W - 14, pY, { align: 'right' });
  }

  doc.save(nomeArq);
}

// -----------------------------------------------------------------------------
// RELATÓRIO 2: HISTÓRICO FILTRADO
// -----------------------------------------------------------------------------
export function gerarHistoricoPDF(historicoFiltrado) {
  const hoje      = new Date();
  const dataHoje  = hoje.toLocaleDateString('pt-BR');
  const horaAgora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nomeArq   = `historico-chromebooks-${hoje.toISOString().slice(0,10)}.pdf`;

  // Usamos Paisagem (landscape) porque o histórico tem muitas colunas
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  let y = 0;

  // Header do PDF
  doc.setFillColor(...COR_HEADER_BG);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_ACCENT);
  doc.text('Chrome', 14, 12);
  const wChrome = doc.getTextWidth('Chrome');
  doc.setTextColor(...COR_ACCENT2);
  doc.text('Control', 14 + wChrome, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COR_MUTED);
  doc.text('Sistema de Gestão de Empréstimos de Equipamentos', 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(`Gerado em ${dataHoje} às ${horaAgora}`, W - 14, 12, { align: 'right' });

  y = 35;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Relatório de Histórico Filtrado`, 14, y);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COR_MUTED);
  doc.text(`Total de registros: ${historicoFiltrado.length}`, 14, y + 6);
  
  y += 12;

  if (historicoFiltrado.length === 0) {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COR_MUTED);
    doc.text('Nenhum registro encontrado com os filtros atuais.', W / 2, y + 7.5, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: y,
      // NOVO: Adicionada a coluna de Acessórios
      head: [['Retirada', 'Responsável', 'Turma / Cargo', 'Equipamentos', 'Acessórios', 'Devolução', 'Status']],
      body: historicoFiltrado.map(h => [
        `${h.dataRetirada}\n(Por: ${h.registradoPor || 'Sistema'})`, 
        h.professorNome, 
        `${formatarTurmas(h.professorTurma)} / ${cargoLabel({ tipo: h.professorTipo, materia: h.professorMateria })}`,
        formatarCBParaPDF(h.chromebooks), 
        formatarAcessoriosParaPDF(h.acessorios), // NOVO
        h.dataDevolucao ? `${h.dataDevolucao}\n(Por: ${h.devolvidoPor || 'Sistema'})` : '—',
        h.status === 'devolvido' ? 'Devolvido' : 'Em andamento',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: COR_TEXT, lineColor: COR_BORDER, lineWidth: 0.3 },
      headStyles: { fillColor: COR_HEADER_BG, textColor: COR_WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COR_SURFACE },
      // Recalculei os tamanhos das colunas para a folha deitada (landscape)
      columnStyles: { 
        0:{cellWidth:35}, 
        1:{cellWidth:40}, 
        2:{cellWidth:35}, 
        3:{cellWidth:50}, 
        4:{cellWidth:30}, // Acessórios
        5:{cellWidth:35}, 
        6:{cellWidth:'auto'} 
      },
      didDrawCell(data) {
        if (data.section === 'body' && data.column.index === 6) {
          const isDevolvido = data.cell.raw === 'Devolvido';
          const cor = isDevolvido ? COR_ACCENT2 : COR_WARN;
          doc.setTextColor(...cor);
          doc.setFont('helvetica', 'bold');
          
          doc.text(data.cell.raw, data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2 + 1);
        }
      },
    });
  }

  // Rodapé em todas as páginas
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pY = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pY - 3, W - 14, pY - 3);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR_MUTED);
    doc.text('ChromeControl — Sistema de Gestão de Empréstimos', 14, pY);
    doc.text(`Página ${i} de ${pageCount}`, W - 14, pY, { align: 'right' });
  }

  doc.save(nomeArq);
}

// -----------------------------------------------------------------------------
// RELATÓRIO 3: AUDITORIA DE INVENTÁRIO
// -----------------------------------------------------------------------------
export function gerarRelatorioAuditoria(esperados, encontrados, pendentes, usuarioNome) {
  const hoje      = new Date();
  const dataHoje  = hoje.toLocaleDateString('pt-BR');
  const horaAgora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nomeArq   = `auditoria-inventario-${hoje.toISOString().slice(0,10)}.pdf`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  let y = 0;

  // Header do PDF
  doc.setFillColor(...COR_HEADER_BG);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_ACCENT);
  doc.text('Chrome', 14, 12);
  const wChrome = doc.getTextWidth('Chrome');
  doc.setTextColor(...COR_ACCENT2);
  doc.text('Control', 14 + wChrome, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COR_MUTED);
  doc.text('Sistema de Gestão de Empréstimos de Equipamentos', 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(`Auditoria gerada em ${dataHoje} às ${horaAgora}`, W - 14, 12, { align: 'right' });
  doc.text(`Responsável: ${usuarioNome || 'Sistema'}`, W - 14, 18, { align: 'right' });

  y = 35;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Relatório de Inventário Relâmpago`, 14, y);
  y += 8;

  // Cartões de Resumo
  const cards = [
    { label: 'Deveriam Estar no Armário', valor: esperados.length, cor: COR_ACCENT },
    { label: 'Equipamentos Encontrados',  valor: encontrados.length, cor: COR_ACCENT2 },
    { label: 'Equipamentos Faltando',     valor: pendentes.length, cor: pendentes.length > 0 ? COR_DANGER : COR_MUTED },
  ];

  const cardW = (W - 28 - 10) / 3;
  const cardH = 18;
  let cx = 14;

  cards.forEach(c => {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'S');
    doc.setFillColor(...c.cor);
    doc.roundedRect(cx, y, 3, cardH, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR_MUTED);
    doc.text(c.label.toUpperCase(), cx + 7, y + 6);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.cor);
    doc.text(String(c.valor), cx + 7, y + 14);
    cx += cardW + 5;
  });

  y += cardH + 10;

  // Tabela: Pendentes (Faltando)
  doc.setFillColor(...(pendentes.length > 0 ? COR_DANGER : COR_ACCENT2));
  doc.rect(14, y, 3, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Equipamentos Pendentes / Faltando (${pendentes.length})`, 20, y + 5.5);
  y += 12;

  if (pendentes.length === 0) {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COR_ACCENT2);
    doc.text('Auditoria perfeita! Todos os equipamentos foram encontrados.', W / 2, y + 7.5, { align: 'center' });
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['ID / Etiqueta', 'Nº', 'Patrimônio', 'Característica']],
      body: pendentes.map(p => [ p.id, p.numero || '—', p.patrimonio, p.cor ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: COR_TEXT, lineColor: COR_BORDER, lineWidth: 0.3 },
      headStyles: { fillColor: COR_HEADER_BG, textColor: COR_WARN, fontStyle: 'bold' }, // Cabeçalho com texto amarelo
      alternateRowStyles: { fillColor: [255, 245, 245] }, // Fundo levemente avermelhado
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (y > 240) { doc.addPage(); y = 20; }

  // Tabela: Encontrados
  doc.setFillColor(...COR_ACCENT2);
  doc.rect(14, y, 3, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_TEXT);
  doc.text(`Equipamentos Encontrados (${encontrados.length})`, 20, y + 5.5);
  y += 12;

  if (encontrados.length === 0) {
    doc.setFillColor(...COR_SURFACE);
    doc.roundedRect(14, y, W - 28, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COR_MUTED);
    doc.text('Nenhum equipamento foi bipado nesta auditoria.', W / 2, y + 7.5, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: y,
      head: [['ID / Etiqueta', 'Nº', 'Patrimônio', 'Característica']],
      body: encontrados.map(e => [ e.id, e.numero || '—', e.patrimonio, e.cor ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: COR_TEXT, lineColor: COR_BORDER, lineWidth: 0.3 },
      headStyles: { fillColor: COR_HEADER_BG, textColor: COR_ACCENT2, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COR_SURFACE },
    });
  }

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pY = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pY - 3, W - 14, pY - 3);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR_MUTED);
    doc.text('ChromeControl — Sistema de Gestão de Empréstimos', 14, pY);
    doc.text(`Página ${i} de ${pageCount}`, W - 14, pY, { align: 'right' });
  }

  doc.save(nomeArq);
}