/**
 * exercicios.js - Plano semanal de exercícios, treino ao vivo e gráficos
 */
(function () {
    const CHAVE = 'dc_exercicios';
    const ATIV = {
        caminhada: { nome: 'Caminhada', ic: '🚶' }, bicicleta: { nome: 'Bicicleta', ic: '🚴' },
        natacao: { nome: 'Natação', ic: '🏊' }, forca: { nome: 'Musculação', ic: '🏋️' },
        alongamento: { nome: 'Alongamento', ic: '🧘' }, danca: { nome: 'Dança', ic: '💃' },
        corrida: { nome: 'Corrida leve', ic: '🏃' }, hiit: { nome: 'Intervalado', ic: '⚡' }
    };
    // Cada dia: lista [atividade, minutos]; null = descanso (índice 0 = segunda)
    const PLANOS = {
        iniciante: [[['caminhada', 20]], null, [['caminhada', 20], ['alongamento', 10]], null, [['bicicleta', 20]], [['caminhada', 30]], null],
        intermediario: [[['caminhada', 30]], [['forca', 25]], [['bicicleta', 30]], null, [['forca', 25], ['alongamento', 10]], [['natacao', 30]], [['caminhada', 15]]],
        avancado: [[['corrida', 35]], [['forca', 40]], [['bicicleta', 40]], [['hiit', 25]], [['forca', 40]], [['natacao', 40]], [['alongamento', 20]]]
    };
    const NOMES_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const META = { iniciante: 90, intermediario: 150, avancado: 210 };
    const $ = id => document.getElementById(id);
    let estado = carregar();
    let timer = null, inicio = 0, charts = {};

    function carregar() {
        try { return { nivel: 'intermediario', feitos: {}, treinos: [], ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; }
        catch { return { nivel: 'intermediario', feitos: {}, treinos: [] }; }
    }
    const salvar = () => localStorage.setItem(CHAVE, JSON.stringify(estado));
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    function diasDaSemana() {
        const hoje = new Date();
        const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7));
        return NOMES_DIA.map((nome, i) => { const d = new Date(seg); d.setDate(seg.getDate() + i); return { nome, data: iso(d), idx: i, hoje: iso(d) === iso(hoje) }; });
    }

    function minutosDoDia(data) {
        const idxDia = (new Date(data + 'T12:00').getDay() + 6) % 7;
        const plano = PLANOS[estado.nivel][idxDia] || [];
        const feitos = estado.feitos[data] || [];
        const doPlano = plano.reduce((s, [, m], i) => s + (feitos.includes(`${estado.nivel}-${i}`) ? m : 0), 0);
        const vivo = estado.treinos.filter(t => t.data === data).reduce((s, t) => s + t.min, 0);
        return doPlano + vivo;
    }

    function renderAviso() {
        const regs = (window.ArmazenamentoDados?.dados?.glicemias || []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const el = $('ex-aviso');
        const ult = regs[regs.length - 1];
        if (!ult) { el.innerHTML = `<i class="fas fa-circle-info"></i><span>Registre sua glicemia antes de treinar para receber orientações de segurança.</span>`; el.className = 'dc-aviso'; return; }
        const v = ult.glicemia;
        let cls = 'dc-ok', ic = 'fa-circle-check', txt = 'Faixa adequada para exercício. Mantenha-se hidratado.';
        if (v < 70) { cls = 'dc-bad'; ic = 'fa-hand'; txt = 'Glicemia baixa: NÃO treine agora. Consuma ~15 g de carboidrato de ação rápida e meça novamente em 15 min.'; }
        else if (v < 100) { cls = 'dc-warn'; ic = 'fa-cookie-bite'; txt = 'Glicemia no limite inferior: faça um lanche com carboidrato (~15 g) antes de treinar.'; }
        else if (v > 300) { cls = 'dc-bad'; ic = 'fa-hand'; txt = 'Glicemia muito alta: evite exercício intenso e procure orientação médica.'; }
        else if (v > 250) { cls = 'dc-warn'; ic = 'fa-triangle-exclamation'; txt = 'Glicemia alta: prefira atividade leve e verifique cetonas se tiver diabetes tipo 1.'; }
        el.className = `dc-aviso ${cls}`;
        el.innerHTML = `<i class="fas ${ic}"></i><span><b>Última glicemia: ${v} mg/dL.</b> ${txt}</span>`;
    }

    function renderNivel() {
        document.querySelectorAll('#ex-nivel .dc-nivel-op').forEach(b => b.classList.toggle('ativo', b.dataset.nivel === estado.nivel));
    }

    function renderSemana() {
        const dias = diasDaSemana();
        $('ex-semana').innerHTML = dias.map(d => {
            const plano = PLANOS[estado.nivel][d.idx];
            const feitos = estado.feitos[d.data] || [];
            const corpo = plano ? plano.map(([a, m], i) => {
                const id = `${estado.nivel}-${i}`;
                return `<button class="dc-ex ${feitos.includes(id) ? 'feito' : ''}" data-data="${d.data}" data-id="${id}" aria-pressed="${feitos.includes(id)}">
                    <span class="ic">${ATIV[a].ic}</span><span>${ATIV[a].nome}<small>${m} min</small></span></button>`;
            }).join('') : '<div class="dc-descanso">😴 Descanso</div>';
            return `<div class="dc-dia ${d.hoje ? 'hoje' : ''}"><h4>${d.nome}${d.hoje ? '<span>hoje</span>' : ''}</h4>${corpo}</div>`;
        }).join('');
    }

    function renderProgresso() {
        const dias = diasDaSemana();
        const total = dias.reduce((s, d) => s + minutosDoDia(d.data), 0);
        const meta = META[estado.nivel];
        const pct = Math.min(100, Math.round((total / meta) * 100));
        $('ex-min-sem').textContent = `${total} min`;
        $('ex-meta-sem').textContent = meta;
        $('ex-anel-txt').textContent = `${pct}%`;
        $('ex-anel-fg').style.strokeDashoffset = 326.7 * (1 - pct / 100);
        let seq = 0;
        for (let d = new Date(); seq < 365; d.setDate(d.getDate() - 1)) {
            if (minutosDoDia(iso(d)) > 0) seq++;
            else if (iso(d) !== iso(new Date())) break;
        }
        $('ex-sequencia').textContent = [seq ? `🔥 Sequência: ${seq} dia(s)` : '', pct >= 100 ? '🏆 Meta semanal atingida!' : ''].filter(Boolean).join(' · ');
    }

    function grafico(id, cfg) {
        charts[id]?.destroy();
        if (typeof Chart === 'undefined' || !$(id)) return;
        Chart.defaults.color = getComputedStyle(document.body).color;
        charts[id] = new Chart($(id), cfg);
    }

    function renderGraficos() {
        const dias = diasDaSemana();
        const meta = Math.round(META[estado.nivel] / 7);
        grafico('ex-chart-min', {
            data: {
                labels: dias.map(d => d.nome),
                datasets: [
                    { type: 'bar', label: 'Minutos', data: dias.map(d => minutosDoDia(d.data)), backgroundColor: dias.map(d => (minutosDoDia(d.data) >= meta ? '#2ecc71' : '#4361ee')), borderRadius: 10 },
                    { type: 'line', label: `Média diária da meta (${meta} min)`, data: dias.map(() => meta), borderColor: '#ff9e00', borderDash: [6, 6], pointRadius: 0 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
        const comGlic = estado.treinos.filter(t => t.antes && t.depois).slice(-10);
        grafico('ex-chart-efeito', {
            type: 'bar',
            data: {
                labels: comGlic.map(t => new Date(t.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
                datasets: [{ label: 'Antes', data: comGlic.map(t => t.antes), backgroundColor: '#ff9e00', borderRadius: 6 }, { label: 'Depois', data: comGlic.map(t => t.depois), backgroundColor: '#2ecc71', borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'mg/dL' } } }, plugins: { tooltip: { callbacks: { afterBody: i => { const t = comGlic[i[0].dataIndex]; return `Variação: ${t.depois - t.antes > 0 ? '+' : ''}${t.depois - t.antes} mg/dL`; } } } } }
        });
    }

    function renderHistorico() {
        const ul = $('ex-historico');
        ul.innerHTML = '';
        const lista = estado.treinos.slice().reverse();
        $('ex-apagar-todos').disabled = !lista.length;
        atualizarBotaoSelecionados();
        if (!lista.length) { ul.innerHTML = '<li><span>Nenhum treino registrado ainda. Use o cronômetro ao lado!</span></li>'; return; }
        lista.forEach(t => {
            const li = document.createElement('li');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'ex-sel';
            chk.dataset.id = t.id;
            chk.setAttribute('aria-label', 'Selecionar treino');
            const a = document.createElement('span');
            a.textContent = `${ATIV[t.tipo]?.ic || ''} ${ATIV[t.tipo]?.nome || t.tipo} · ${t.min} min · ${new Date(t.ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
            const b = document.createElement('span');
            b.className = 'dc-tag';
            b.textContent = t.antes && t.depois ? `${t.antes} → ${t.depois} mg/dL` : 'sem glicemia';
            li.append(chk, a, b);
            ul.appendChild(li);
        });
    }

    function atualizarBotaoSelecionados() {
        $('ex-apagar-sel').disabled = !document.querySelector('#ex-historico .ex-sel:checked');
    }

    function renderTudo() { renderAviso(); renderNivel(); renderSemana(); renderProgresso(); renderGraficos(); renderHistorico(); }

    function formatar(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

    function iniciar() {
        inicio = Date.now();
        $('ex-iniciar').disabled = true; $('ex-parar').disabled = false;
        $('ex-timer').classList.add('rodando');
        timer = setInterval(() => { $('ex-timer').textContent = formatar(Math.floor((Date.now() - inicio) / 1000)); }, 500);
    }

    function parar() {
        clearInterval(timer);
        const seg = Math.floor((Date.now() - inicio) / 1000);
        $('ex-timer').classList.remove('rodando');
        $('ex-timer').textContent = '00:00';
        $('ex-iniciar').disabled = false; $('ex-parar').disabled = true;
        const min = Math.max(1, Math.round(seg / 60));
        const antes = parseInt($('ex-antes').value) || null, depois = parseInt($('ex-depois').value) || null;
        const agora = new Date();
        estado.treinos.push({ id: Date.now(), ts: agora.getTime(), data: iso(agora), tipo: $('ex-tipo').value, min, antes, depois });
        salvar();
        $('ex-antes').value = ''; $('ex-depois').value = '';
        renderTudo();
        if (window.Notificacoes?.sucesso) window.Notificacoes.sucesso(`Treino de ${min} min registrado!`);
    }

    function init() {
        if (!$('exercicios')) return;
        $('ex-tipo').innerHTML = Object.entries(ATIV).map(([k, v]) => `<option value="${k}">${v.ic} ${v.nome}</option>`).join('');
        $('ex-nivel').addEventListener('click', e => {
            const b = e.target.closest('[data-nivel]'); if (!b) return;
            estado.nivel = b.dataset.nivel; salvar(); renderTudo();
        });
        $('ex-semana').addEventListener('click', e => {
            const b = e.target.closest('.dc-ex'); if (!b) return;
            const lista = (estado.feitos[b.dataset.data] ||= []);
            const i = lista.indexOf(b.dataset.id);
            if (i >= 0) lista.splice(i, 1); else lista.push(b.dataset.id);
            salvar(); renderTudo();
        });
        $('ex-historico').addEventListener('change', atualizarBotaoSelecionados);
        $('ex-apagar-sel').addEventListener('click', () => {
            const ids = [...document.querySelectorAll('#ex-historico .ex-sel:checked')].map(c => Number(c.dataset.id));
            if (!ids.length || !confirm(`Apagar ${ids.length} treino(s) selecionado(s)?`)) return;
            estado.treinos = estado.treinos.filter(t => !ids.includes(t.id));
            salvar(); renderTudo();
            window.Notificacoes?.sucesso?.('Treino(s) apagado(s)');
        });
        $('ex-apagar-todos').addEventListener('click', () => {
            if (!estado.treinos.length || !confirm('Apagar TODOS os treinos do histórico?')) return;
            estado.treinos = [];
            salvar(); renderTudo();
            window.Notificacoes?.sucesso?.('Histórico de treinos apagado');
        });
        $('ex-iniciar').addEventListener('click', iniciar);
        $('ex-parar').addEventListener('click', parar);
        document.addEventListener('secaoAtivada', e => { if (e.detail.secaoId === 'exercicios') setTimeout(renderTudo, 50); });
    }

    window.exerciciosSistema = { render: renderTudo };
    init();
})();
