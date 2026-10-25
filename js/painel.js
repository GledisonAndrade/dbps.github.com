/**
 * painel.js - Painel interativo com KPIs, gráficos e exportação em PDF
 */
(function () {
    const COR = { baixa: '#4cc9f0', normal: '#2ecc71', alta: '#ff9e00', muito: '#e74c3c' };
    const FAIXAS = [
        { id: 'baixa', nome: 'Baixa (<70)', cor: COR.baixa, teste: v => v < 70 },
        { id: 'normal', nome: 'Normal (70-180)', cor: COR.normal, teste: v => v >= 70 && v <= 180 },
        { id: 'alta', nome: 'Alta (181-250)', cor: COR.alta, teste: v => v > 180 && v <= 250 },
        { id: 'muito', nome: 'Muito alta (>250)', cor: COR.muito, teste: v => v > 250 }
    ];
    const estado = { dias: 14, tipo: 'line', charts: {} };

    const $ = id => document.getElementById(id);
    const faixaDe = v => FAIXAS.find(f => f.teste(v));
    const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const tsDe = g => g.timestamp || new Date(`${g.data}T${g.hora || '00:00'}`).getTime();

    function obterRegistros() {
        const todos = (window.ArmazenamentoDados?.dados?.glicemias || []).slice().sort((a, b) => tsDe(a) - tsDe(b));
        if (!estado.dias) return todos;
        const corte = Date.now() - estado.dias * 86400000;
        return todos.filter(g => tsDe(g) >= corte);
    }

    function calcular(regs) {
        const vals = regs.map(g => g.glicemia);
        const m = media(vals);
        const dp = Math.sqrt(media(vals.map(v => (v - m) ** 2)));
        const contagem = Object.fromEntries(FAIXAS.map(f => [f.id, vals.filter(f.teste).length]));
        return {
            n: vals.length, media: m, dp, cv: m ? (dp / m) * 100 : 0,
            min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0,
            gmi: vals.length ? 3.31 + 0.02392 * m : 0, // Indicador de Gerenciamento da Glicose (HbA1c estimada)
            tir: vals.length ? (contagem.normal / vals.length) * 100 : 0, contagem
        };
    }

    function animarNumero(aplicar, alvo, casas = 0) {
        const ini = performance.now();
        const passo = t => {
            const p = Math.min((t - ini) / 700, 1);
            aplicar((alvo * (1 - Math.pow(1 - p, 3)))            .toFixed(casas));
            if (p < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
    }

    function renderKpis(s) {
        const itens = [
            { i: 'fa-droplet', l: 'Glicemia média', v: s.media, u: 'mg/dL', c: faixaDe(s.media)?.cor, sub: s.n ? faixaDe(s.media).nome : '' },
            { i: 'fa-vial', l: 'HbA1c estimada (GMI)', v: s.gmi, u: '%', casas: 1, c: s.gmi <= 7 ? COR.normal : s.gmi <= 8 ? COR.alta : COR.muito, sub: s.gmi ? (s.gmi <= 7 ? 'Dentro da meta usual' : 'Acima de 7%') : '' },
            { i: 'fa-bullseye', l: 'Tempo no alvo (70-180)', v: s.tir, u: '%', c: s.tir >= 70 ? COR.normal : COR.alta, sub: 'Meta: ≥ 70%' },
            { i: 'fa-wave-square', l: 'Variabilidade (CV)', v: s.cv, u: '%', c: s.cv <= 36 ? COR.normal : COR.alta, sub: s.cv <= 36 ? 'Estável (≤ 36%)' : 'Instável (> 36%)' },
            { i: 'fa-arrows-up-down', l: 'Mín / Máx', txt: s.n ? `${s.min} / ${s.max}` : '-', c: '#7b5cff', sub: 'mg/dL' },
            { i: 'fa-list-check', l: 'Registros', v: s.n, c: '#4361ee', sub: estado.dias ? `últimos ${estado.dias} dias` : 'todo o histórico' }
        ];
        $('painel-kpis').innerHTML = itens.map((k, idx) => `
            <div class="dc-kpi" style="--kpi:${k.c || '#4361ee'}"><i class="fas ${k.i}"></i>
            <div class="v" data-k="${idx}">${k.txt ?? '0'}${k.u ? ` <small>${k.u}</small>` : ''}</div>
            <div class="l">${k.l}</div><div class="s">${k.sub || ''}</div></div>`).join('');
        itens.forEach((k, idx) => {
            if (k.txt !== undefined) return;
            const no = document.querySelector(`[data-k="${idx}"]`).firstChild;
            animarNumero(t => { no.textContent = t + ' '; }, k.v || 0, k.casas || 0);
        });
    }

    function renderInsights(regs, s) {
        const el = $('painel-insights');
        if (!s.n) { el.innerHTML = `<div class="dc-insight"><i class="fas fa-circle-info"></i><span>Sem registros no período. Registre sua glicemia para ver análises.</span></div>`; return; }
        const msgs = [];
        const add = (cls, ic, txt) => msgs.push(`<div class="dc-insight ${cls}"><i class="fas ${ic}"></i><span>${txt}</span></div>`);
        if (s.tir >= 70) add('dc-ok', 'fa-circle-check', `Ótimo! ${s.tir.toFixed(0)}% das medições estão no alvo.`);
        else add('dc-warn', 'fa-triangle-exclamation', `Apenas ${s.tir.toFixed(0)}% das medições estão no alvo (meta ≥ 70%).`);
        if (s.contagem.baixa) add('dc-bad', 'fa-arrow-down', `${s.contagem.baixa} medição(ões) com hipoglicemia (<70 mg/dL). Atenção ao risco de quedas.`);
        if (s.contagem.muito) add('dc-bad', 'fa-arrow-up', `${s.contagem.muito} medição(ões) muito altas (>250 mg/dL).`);
        const porPeriodo = periodos(regs).filter(p => p.n);
        if (porPeriodo.length > 1) {
            const pior = porPeriodo.reduce((a, b) => (b.media > a.media ? b : a));
            add('', 'fa-clock', `Maior média no período <b>${pior.nome}</b>: ${pior.media.toFixed(0)} mg/dL.`);
        }
        const metade = Math.floor(regs.length / 2);
        if (metade >= 3) {
            const d = media(regs.slice(metade).map(g => g.glicemia)) - media(regs.slice(0, metade).map(g => g.glicemia));
            if (Math.abs(d) >= 5) add(d < 0 ? 'dc-ok' : 'dc-warn', d < 0 ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up', `Tendência: média ${d < 0 ? 'caiu' : 'subiu'} ${Math.abs(d).toFixed(0)} mg/dL na segunda metade do período.`);
        }
        el.innerHTML = msgs.join('');
    }

    function periodos(regs) {
        const defs = [
            { nome: 'Madrugada', ic: '00-06', t: h => h < 6 }, { nome: 'Manhã', t: h => h >= 6 && h < 12 },
            { nome: 'Tarde', t: h => h >= 12 && h < 18 }, { nome: 'Noite', t: h => h >= 18 }
        ];
        return defs.map(d => {
            const v = regs.filter(g => d.t(new Date(tsDe(g)).getHours())).map(g => g.glicemia);
            return { nome: d.nome, n: v.length, media: media(v) };
        });
    }

    function criarGrafico(id, cfg) {
        estado.charts[id]?.destroy();
        const canvas = $(id);
        if (!canvas || typeof Chart === 'undefined') return;
        const txt = getComputedStyle(document.body).color;
        Chart.defaults.color = txt;
        estado.charts[id] = new Chart(canvas, cfg);
    }

    const corPonto = v => faixaDe(v).cor;
    const opcoesBase = { responsive: true, maintainAspectRatio: false, animation: { duration: 700 } };

    function renderGraficos(regs, s) {
        const fmt = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const linha = estado.tipo === 'line';
        criarGrafico('pn-linha', {
            type: estado.tipo,
            data: {
                labels: regs.map(g => fmt(tsDe(g))),
                datasets: [
                    { label: 'Glicemia', data: regs.map(g => g.glicemia), borderColor: '#4361ee', backgroundColor: linha ? 'rgba(67,97,238,.12)' : regs.map(g => corPonto(g.glicemia)), fill: linha, tension: .35, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: regs.map(g => corPonto(g.glicemia)), order: 1 },
                    ...(linha ? [{ label: 'Limite 70', data: regs.map(() => 70), borderColor: COR.baixa, borderDash: [6, 6], pointRadius: 0, borderWidth: 1.5 },
                        { label: 'Limite 180', data: regs.map(() => 180), borderColor: COR.alta, borderDash: [6, 6], pointRadius: 0, borderWidth: 1.5 }] : [])
                ]
            },
            options: { ...opcoesBase, interaction: { mode: 'index', intersect: false }, scales: { y: { suggestedMin: 40, title: { display: true, text: 'mg/dL' } }, x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } } },
                plugins: { tooltip: { callbacks: { afterLabel: c => c.datasetIndex === 0 ? `${faixaDe(c.parsed.y).nome}${regs[c.dataIndex].observacao ? '\n' + regs[c.dataIndex].observacao : ''}` : '' } } } }
        });

        criarGrafico('pn-rosca', {
            type: 'doughnut',
            data: { labels: FAIXAS.map(f => f.nome), datasets: [{ data: FAIXAS.map(f => s.contagem[f.id] || 0), backgroundColor: FAIXAS.map(f => f.cor), borderWidth: 2, hoverOffset: 14 }] },
            options: { ...opcoesBase, cutout: '62%', plugins: { legend: { position: 'bottom' } },
                onClick: (_, els) => { if (els.length) mostrarDetalhe(FAIXAS[els[0].index], regs); },
                onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } }
        });

        const p = periodos(regs);
        criarGrafico('pn-periodo', {
            type: 'bar',
            data: { labels: p.map(x => x.nome), datasets: [{ label: 'Média (mg/dL)', data: p.map(x => +x.media.toFixed(1)), backgroundColor: p.map(x => (x.n ? faixaDe(x.media).cor : '#ccc')), borderRadius: 10 }] },
            options: { ...opcoesBase, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const porDia = dias.map((_, i) => media(regs.filter(g => new Date(tsDe(g)).getDay() === i).map(g => g.glicemia)));
        criarGrafico('pn-semana', {
            type: 'radar',
            data: { labels: dias, datasets: [{ label: 'Média (mg/dL)', data: porDia.map(v => +v.toFixed(1)), backgroundColor: 'rgba(123,92,255,.25)', borderColor: '#7b5cff', pointBackgroundColor: '#7b5cff' }] },
            options: { ...opcoesBase, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true } } }
        });
    }

    function mostrarDetalhe(faixa, regs) {
        const lista = regs.filter(g => faixa.teste(g.glicemia)).reverse();
        $('painel-detalhe-titulo').textContent = `${faixa.nome} — ${lista.length} registro(s)`;
        const ul = $('painel-detalhe');
        ul.innerHTML = '';
        lista.forEach(g => {
            const li = document.createElement('li');
            const a = document.createElement('span');
            a.textContent = `${new Date(tsDe(g)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${g.observacao ? ' · ' + g.observacao : ''}`;
            const b = document.createElement('span');
            b.className = 'dc-tag';
            b.style.setProperty('--tag', faixa.cor);
            b.textContent = `${g.glicemia} mg/dL`;
            li.append(a, b);
            ul.appendChild(li);
        });
        $('painel-detalhe-card').hidden = false;
        $('painel-detalhe-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function render() {
        const regs = obterRegistros();
        const s = calcular(regs);
        $('painel-detalhe-card').hidden = true;
        renderKpis(s);
        renderInsights(regs, s);
        renderGraficos(regs, s);
    }

    async function exportarPdf() {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF || !window.html2canvas) { alert('Bibliotecas de PDF não carregadas (verifique a conexão).'); return; }
        const btn = $('painel-pdf');
        btn.disabled = true;
        try {
            const alvo = $('painel-conteudo');
            const canvas = await html2canvas(alvo, { scale: 1.5, backgroundColor: getComputedStyle(document.body).backgroundColor });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth() - 20;
            const pageH = pdf.internal.pageSize.getHeight() - 30;
            const hTotal = (canvas.height * w) / canvas.width;
            pdf.setFontSize(16);
            pdf.text('DiabetesCare - Relatório do Painel', 10, 12);
            pdf.setFontSize(9);
            pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${estado.dias ? 'Últimos ' + estado.dias + ' dias' : 'Todo o histórico'}`, 10, 18);
            const pxPorPag = (pageH * canvas.width) / w;
            for (let y = 0, pag = 0; y < canvas.height; y += pxPorPag, pag++) {
                const fatia = document.createElement('canvas');
                fatia.width = canvas.width;
                fatia.height = Math.min(pxPorPag, canvas.height - y);
                fatia.getContext('2d').drawImage(canvas, 0, y, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);
                if (pag) pdf.addPage();
                pdf.addImage(fatia.toDataURL('image/jpeg', 0.92), 'JPEG', 10, pag ? 10 : 24, w, (fatia.height * w) / canvas.width);
            }
            pdf.save(`painel-diabetescare-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Não foi possível gerar o PDF.');
        } finally { btn.disabled = false; }
    }

    function init() {
        if (!$('painel')) return;
        $('painel-periodo').addEventListener('click', e => {
            const b = e.target.closest('[data-dias]'); if (!b) return;
            estado.dias = +b.dataset.dias;
            $('painel-periodo').querySelectorAll('.dc-chip').forEach(c => c.classList.toggle('ativo', c === b));
            render();
        });
        $('painel-tipo').addEventListener('click', e => {
            const b = e.target.closest('[data-tipo]'); if (!b) return;
            estado.tipo = b.dataset.tipo;
            $('painel-tipo').querySelectorAll('.dc-chip').forEach(c => c.classList.toggle('ativo', c === b));
            render();
        });
        $('painel-detalhe-fechar').addEventListener('click', () => { $('painel-detalhe-card').hidden = true; });
        $('painel-pdf').addEventListener('click', exportarPdf);
        document.addEventListener('secaoAtivada', e => { if (e.detail.secaoId === 'painel') setTimeout(render, 50); });
        document.addEventListener('themeChanged', () => { if ($('painel').classList.contains('ativa')) render(); });
    }

    window.painelSistema = { render };
    init();
})();
