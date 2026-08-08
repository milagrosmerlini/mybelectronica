import datastore from './datastore.js?v=20260806-speed1';

const lista = document.getElementById('listaReparaciones');
const fotoInput = document.getElementById('fotoInput');
const vistaPreviaIngreso = document.getElementById('vistaPreviaIngreso');
const btnGuardar = document.getElementById('btn-guardar');
const fileInput = document.getElementById('fileInput');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const btnTomarFotos = document.getElementById('btn-tomar-fotos');
const buscar = document.getElementById('buscar');
const btnRefrescar = document.getElementById('btn-refrescar');
const btnActualizarApp = document.getElementById('btn-actualizar-app');
const estadoActualizacionApp = document.getElementById('estado-actualizacion-app');
const btnAgendaVcf = document.getElementById('btn-agenda-vcf');
const agendaVcfContador = document.getElementById('agenda-vcf-contador');
const agendaVcfEstado = document.getElementById('agenda-vcf-estado');
const menuCobrar = document.getElementById('menu-cobrar');
const menuReparaciones = document.getElementById('menu-reparaciones');
const menuCaja = document.getElementById('menu-caja');
const menuBadgeReparaciones = document.getElementById('menu-badge-reparaciones');
const vistaCobrar = document.getElementById('vista-cobrar');
const vistaReparaciones = document.getElementById('vista-reparaciones');
const vistaCaja = document.getElementById('vista-caja');
const ventaCantidad = document.getElementById('venta-cantidad');
const ventaDescripcion = document.getElementById('venta-descripcion');
const listaArticulos = document.getElementById('lista-articulos');
const descripcionWrap = document.querySelector('.descripcion-wrap');
const ventaImporte = document.getElementById('venta-importe');
const btnAgregarItem = document.getElementById('btn-agregar-item');
const btnRegistrarVenta = document.getElementById('btn-registrar-venta');
const tablaItemsBody = document.getElementById('tabla-items-body');
const tablaTotalGeneralValor = document.getElementById('tabla-total-general-valor');
const ventaTotalFinal = document.getElementById('venta-total-final');
const totalCobrarNegocio = document.getElementById('total-cobrar-negocio');
const totalCajaNegocio = document.getElementById('total-caja-negocio');
const totalCajaReparaciones = document.getElementById('total-caja-reparaciones');
const historialCobrarNegocio = document.getElementById('historial-cobrar-negocio');
const historialCajaNegocio = document.getElementById('historial-caja-negocio');
const historialCajaReparaciones = document.getElementById('historial-caja-reparaciones');
const cajaMesToggle = document.getElementById('caja-mes-toggle');
const cajaMesLabel = document.getElementById('caja-mes-label');
const cajaMesOpciones = document.getElementById('caja-mes-opciones');

const tabAceptada = document.getElementById('tab-aceptada');
const tabPresupuesta = document.getElementById('tab-presupuesta');
const tabTaller = document.getElementById('tab-taller');
const tabTerminada = document.getElementById('tab-terminada');
const tabArchivada = document.getElementById('tab-archivada');

const cantAceptada = document.getElementById('cant-aceptada');
const cantPresupuesto = document.getElementById('cant-presupuesto');
const cantTaller = document.getElementById('cant-taller');
const cantTerminada = document.getElementById('cant-terminada');
const cantArchivada = document.getElementById('cant-archivada');

const photoViewer = document.getElementById('photoViewer');
const viewerClose = document.getElementById('viewerClose');
const viewerPrev = document.getElementById('viewerPrev');
const viewerNext = document.getElementById('viewerNext');
const viewerImage = document.getElementById('viewerImage');
const viewerIndex = document.getElementById('viewerIndex');
const viewerTotal = document.getElementById('viewerTotal');
const dataSourceStatus = document.getElementById('data-source-status');

const REPARACIONES_BADGE_CACHE_KEY = 'myb_reparaciones_activas';
const AGENDA_VCF_PENDIENTES_KEY = 'myb_agenda_vcf_pendientes_v1';
const AGENDA_VCF_REGISTRADOS_KEY = 'myb_agenda_vcf_registrados_v1';
try {
    const contadorGuardado = localStorage.getItem(REPARACIONES_BADGE_CACHE_KEY);
    if (menuBadgeReparaciones && /^\d+$/.test(contadorGuardado || '')) {
        menuBadgeReparaciones.textContent = contadorGuardado;
    }
} catch (_err) {
    // localStorage puede estar deshabilitado; IndexedDB actualizara el valor enseguida.
}

const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

let fotosTemporalesIngreso = [];
let serviceWorkerRegistration = null;
let serviceWorkerReloadTriggered = false;
let serviceWorkerHadControllerAtBoot = false;
let serviceWorkerUpdateIntervalId = null;
let reparaciones = [];
let contactosAgendaPendientes = [];
let telefonosAgendaRegistrados = new Set();
let proximoNumeroOrden = 1;
let estadoActualFiltrado = 'Aceptada';
let viewerPhotos = [];
let viewerCurrent = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;
let viewerScale = 1;
let viewerTranslateX = 0;
let viewerTranslateY = 0;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let panStartX = 0;
let panStartY = 0;
let panStartTranslateX = 0;
let panStartTranslateY = 0;
let isPinching = false;
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
let blobUrlsRenderizados = [];
let seccionActual = 'cobrar';
let cajaState = {
    cajaNegocioTotal: 0,
    cajaReparacionesTotal: 0,
    historialNegocio: [],
    historialReparaciones: []
};
let catalogoArticulos = [];
const CATALOGO_ARTICULOS_URL = './articulos-nombres.json?v=20260519-menu11';
const OPCIONES_BASE_DESCRIPCION = ['Consumidor final', '+Agregar descripción'];
let itemsVentaActual = [];
let totalVentaManualOverride = null;
const cajaVista = {
    negocio: { mostrarTodosLosDias: false, diaSeleccionado: null },
    reparaciones: { mostrarTodosLosDias: false, diaSeleccionado: null }
};
let cajaMesSeleccionado = claveMesLocal(new Date());

function createIconSvg(paths) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of paths) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    }
    return svg;
}

function obtenerMensajeError(err) {
    return String(err && (err.message || err.name || err) || 'Error desconocido.');
}

let dialogQueue = Promise.resolve();

function enqueueDialog(task) {
    const run = dialogQueue.then(() => task());
    dialogQueue = run.catch(() => {});
    return run;
}

function createDialogElements({ title, message, showInput, defaultValue, okText, cancelText, danger }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-dialog-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'app-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h3');
    titleEl.className = 'app-dialog-title';
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.className = 'app-dialog-message';
    messageEl.textContent = message;

    const inputEl = document.createElement('input');
    inputEl.className = 'app-dialog-input';
    inputEl.type = 'text';
    inputEl.value = defaultValue || '';

    const actions = document.createElement('div');
    actions.className = 'app-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'app-dialog-btn app-dialog-btn-cancel';
    cancelBtn.textContent = cancelText || 'Cancelar';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = `app-dialog-btn ${danger ? 'app-dialog-btn-danger' : 'app-dialog-btn-ok'}`;
    okBtn.textContent = okText || 'Aceptar';

    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    if (showInput) dialog.appendChild(inputEl);
    if (cancelText) actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);

    return { backdrop, dialog, inputEl, okBtn, cancelBtn };
}

function uiAlert(message, options = {}) {
    return enqueueDialog(() => new Promise((resolve) => {
        const { backdrop, dialog, okBtn } = createDialogElements({
            title: options.title || 'Aviso',
            message: String(message || ''),
            showInput: false,
            defaultValue: '',
            okText: options.okText || 'Entendido',
            cancelText: '',
            danger: false
        });

        const close = () => {
            document.removeEventListener('keydown', onKeyDown);
            backdrop.remove();
            resolve(true);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' || event.key === 'Enter') close();
        };

        okBtn.addEventListener('click', close);
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close();
        });
        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(backdrop);
        okBtn.focus();
    }));
}

function uiConfirm(message, options = {}) {
    return enqueueDialog(() => new Promise((resolve) => {
        const { backdrop, okBtn, cancelBtn } = createDialogElements({
            title: options.title || 'Confirmar',
            message: String(message || ''),
            showInput: false,
            defaultValue: '',
            okText: options.okText || 'Aceptar',
            cancelText: options.cancelText || 'Cancelar',
            danger: Boolean(options.danger)
        });

        const close = (value) => {
            document.removeEventListener('keydown', onKeyDown);
            backdrop.remove();
            resolve(value);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') close(false);
            if (event.key === 'Enter') close(true);
        };

        okBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close(false);
        });
        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(backdrop);
        okBtn.focus();
    }));
}

function uiPrompt(message, defaultValue = '', options = {}) {
    return enqueueDialog(() => new Promise((resolve) => {
        const { backdrop, inputEl, okBtn, cancelBtn } = createDialogElements({
            title: options.title || 'Ingresar dato',
            message: String(message || ''),
            showInput: true,
            defaultValue: String(defaultValue || ''),
            okText: options.okText || 'Guardar',
            cancelText: options.cancelText || 'Cancelar',
            danger: false
        });

        const close = (value) => {
            document.removeEventListener('keydown', onKeyDown);
            backdrop.remove();
            resolve(value);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') close(null);
            if (event.key === 'Enter') close(inputEl.value);
        };

        okBtn.addEventListener('click', () => close(inputEl.value));
        cancelBtn.addEventListener('click', () => close(null));
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close(null);
        });
        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(backdrop);
        inputEl.focus();
        inputEl.select();
    }));
}

function uiEditarOrden(rep) {
    return enqueueDialog(() => new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'app-dialog-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'app-dialog app-dialog-edit';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const titleEl = document.createElement('h3');
        titleEl.className = 'app-dialog-title';
        titleEl.textContent = 'Editar reparacion';

        const form = document.createElement('div');
        form.className = 'app-edit-form';

        const errorEl = document.createElement('div');
        errorEl.className = 'app-edit-error';
        errorEl.setAttribute('aria-live', 'polite');

        const campos = [
            { key: 'nombre', label: 'Nombre', value: rep && rep.nombre, required: true },
            { key: 'apellido', label: 'Apellido', value: rep && rep.apellido, required: false },
            { key: 'telefono', label: 'Telefono', value: rep && rep.telefono, required: false },
            { key: 'tipoArticulo', label: 'Tipo de articulo', value: rep && (rep.tipoArticulo || rep.tipo_articulo), required: true },
            { key: 'marca', label: 'Marca', value: rep && rep.marca, required: true },
            { key: 'modelo', label: 'Modelo', value: rep && rep.modelo, required: false },
            { key: 'serie', label: 'Numero de serie / IMEI', value: rep && rep.serie, required: false },
            { key: 'falla', label: 'Falla reportada', value: rep && rep.falla, required: true, multiline: true, fullWidth: true },
            {
                key: 'detallePresupuesto',
                label: 'Descripcion / diagnostico tecnico',
                value: rep && (rep.detallePresupuesto || rep.detalle_presupuesto),
                required: false,
                multiline: true,
                fullWidth: true
            },
            {
                key: 'precioPresupuesto',
                label: 'Importe de la reparacion',
                value: rep && (rep.precioPresupuesto || rep.precio_presupuesto),
                required: false,
                inputMode: 'numeric'
            },
            {
                key: 'estado',
                label: 'Estado',
                value: rep && rep.estado,
                required: true,
                options: ['Aceptada', 'Presupuestada', 'En Reparación', 'Terminada', 'Archivada']
            },
            {
                key: 'resultado',
                label: 'Resultado',
                value: rep && rep.fueReparado === false ? 'No reparado' : 'Reparado / en proceso',
                required: true,
                options: ['Reparado / en proceso', 'No reparado']
            }
        ];

        const inputs = {};
        for (const campo of campos) {
            const wrap = document.createElement('label');
            wrap.className = 'app-edit-field';
            if (campo.fullWidth) wrap.classList.add('app-edit-field-full');

            const label = document.createElement('span');
            label.textContent = campo.required ? `${campo.label} *` : `${campo.label} (Opcional)`;

            let input;
            if (campo.options) {
                input = document.createElement('select');
                for (const optionValue of campo.options) {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    input.appendChild(option);
                }
            } else {
                input = campo.multiline ? document.createElement('textarea') : document.createElement('input');
            }
            input.className = 'app-dialog-input';
            if (!campo.multiline && !campo.options) input.type = 'text';
            if (campo.inputMode) input.inputMode = campo.inputMode;
            input.value = String(campo.value || '');

            inputs[campo.key] = input;
            wrap.appendChild(label);
            wrap.appendChild(input);
            form.appendChild(wrap);
        }

        const actions = document.createElement('div');
        actions.className = 'app-dialog-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'app-dialog-btn app-dialog-btn-cancel';
        cancelBtn.textContent = 'Cancelar';

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'app-dialog-btn app-dialog-btn-ok';
        okBtn.textContent = 'Guardar';

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        dialog.appendChild(titleEl);
        dialog.appendChild(form);
        dialog.appendChild(errorEl);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);

        const close = (value) => {
            document.removeEventListener('keydown', onKeyDown);
            backdrop.remove();
            resolve(value);
        };

        const obtener = (key) => inputs[key].value.trim();

        const guardar = () => {
            errorEl.textContent = '';
            const requeridos = [
                ['nombre', 'Nombre'],
                ['tipoArticulo', 'Tipo de articulo'],
                ['marca', 'Marca'],
                ['falla', 'Falla reportada'],
                ['estado', 'Estado'],
                ['resultado', 'Resultado']
            ];

            for (const [key, label] of requeridos) {
                if (!obtener(key)) {
                    errorEl.textContent = `Completa el campo ${label}.`;
                    inputs[key].focus();
                    return;
                }
            }

            const tipo = obtener('tipoArticulo').toUpperCase();
            const detalle = obtener('detallePresupuesto').toUpperCase();
            const precioIngresado = obtener('precioPresupuesto');
            const precio = normalizarPrecioGuardado(precioIngresado);
            const fueReparado = obtener('resultado') !== 'No reparado';
            if (precioIngresado && !precio) {
                errorEl.textContent = 'El importe debe contener un numero valido.';
                inputs.precioPresupuesto.focus();
                return;
            }

            close({
                nombre: obtener('nombre').toUpperCase(),
                apellido: obtener('apellido').toUpperCase(),
                telefono: obtener('telefono'),
                tipoArticulo: tipo,
                tipo_articulo: tipo,
                marca: obtener('marca').toUpperCase(),
                modelo: obtener('modelo').toUpperCase(),
                serie: obtener('serie').toUpperCase(),
                falla: obtener('falla').toUpperCase(),
                detallePresupuesto: detalle,
                detalle_presupuesto: detalle,
                precioPresupuesto: precio,
                precio_presupuesto: precio,
                estado: normalizarEstado(obtener('estado')),
                fueReparado,
                fue_reparado: fueReparado
            });
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') close(null);
            if (event.key === 'Enter' && event.ctrlKey) guardar();
        };

        okBtn.addEventListener('click', guardar);
        cancelBtn.addEventListener('click', () => close(null));
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close(null);
        });
        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(backdrop);
        inputs.nombre.focus();
    }));
}

function actualizarIndicadorOrigenDatos() {
    if (!dataSourceStatus || typeof datastore.getStorageModeInfo !== 'function') return;

    const info = datastore.getStorageModeInfo();
    const modoSync = info && info.mode === 'cloud_with_local_cache';
    const modoCloud = modoSync;
    const etiqueta = modoSync
        ? 'NUBE (Supabase)'
        : 'LOCAL (solo este dispositivo)';

    dataSourceStatus.textContent = `Datos: ${etiqueta}`;
    dataSourceStatus.classList.toggle('mode-cloud', modoCloud);
    dataSourceStatus.classList.toggle('mode-local', !modoCloud);
}

async function fetchAndRenderSafe(contexto = 'sincronizar ordenes') {
    try {
        await fetchAndRender();
        return true;
    } catch (err) {
        actualizarIndicadorOrigenDatos();
        const msg = obtenerMensajeError(err);
        console.error(`Error al ${contexto}:`, err);
        await uiAlert(`No se pudo ${contexto}. ${msg}`, { title: 'Error' });
        return false;
    }
}

btnTomarFotos.addEventListener('click', () => fotoInput.click());

fotoInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
        const previewUrl = URL.createObjectURL(file);
        fotosTemporalesIngreso.push({ file, previewUrl });
    }

    fotoInput.value = '';
    mostrarVistaPreviaIngreso();
});

function limpiarFotosTemporalesIngreso() {
    for (const f of fotosTemporalesIngreso) {
        if (f && typeof f.previewUrl === 'string' && f.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(f.previewUrl);
        }
    }
    fotosTemporalesIngreso = [];
}

function liberarBlobUrlsRenderizados(urlsConservadas = new Set()) {
    for (const url of blobUrlsRenderizados) {
        if (urlsConservadas.has(url)) continue;
        try {
            URL.revokeObjectURL(url);
        } catch (_err) {
            // noop
        }
    }
    blobUrlsRenderizados = [];
}

async function intentarPersistenciaStorage() {
    try {
        if (navigator.storage && navigator.storage.persist) {
            await navigator.storage.persist();
        }
    } catch (_err) {
        // noop
    }
}

function mostrarVistaPreviaIngreso() {
    if (fotosTemporalesIngreso.length === 0) {
        vistaPreviaIngreso.style.display = 'none';
        vistaPreviaIngreso.innerHTML = '';
        return;
    }

    vistaPreviaIngreso.style.display = 'flex';
    const urls = fotosTemporalesIngreso.map((f) => f.previewUrl);
    vistaPreviaIngreso.innerHTML = urls
        .map((url, i) => `<div class="foto-contenedor"><img src="${url}" class="foto-miniatura" data-idx="${i}"></div>`)
        .join('');

    vistaPreviaIngreso.querySelectorAll('.foto-miniatura').forEach((img, idx) => {
        img.addEventListener('click', () => openPhotoViewer(urls, idx));
    });
}

function normalizarEstado(estado) {
    const v = String(estado || '').toLowerCase();
    if (v === 'aceptada') return 'Aceptada';
    if (v === 'presupuestada') return 'Presupuestada';
    if (v === 'en reparacion' || v === 'en reparación') return 'En Reparación';
    if (v === 'terminada') return 'Terminada';
    if (v === 'archivada') return 'Archivada';
    return 'Aceptada';
}

function normalizarBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

function extraerNumeroOrden(raw) {
    const direct = Number(raw?.idOrden);
    if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);

    if (typeof raw?.idOrden === 'string') {
        if (raw.idOrden.toLowerCase().startsWith('ord_')) return null;
        const m = raw.idOrden.match(/(\d+)/g);
        if (m && m.length) {
            const n = Number(m[m.length - 1]);
            if (Number.isFinite(n) && n > 0) return Math.trunc(n);
        }
    }

    return null;
}

function normalizarOrden(raw, idx = 0) {
    const id = raw.id || raw.idOrden || `legacy_${Date.now()}_${idx}`;
    const detalle = (raw.detallePresupuesto ?? raw.detalle_presupuesto ?? '').toString();
    const precio = normalizarPrecioGuardado(raw.precioPresupuesto ?? raw.precio_presupuesto ?? '');
    const fueRep = normalizarBoolean(raw.fueReparado, normalizarBoolean(raw.fue_reparado, true));
    return {
        id,
        idOrden: raw.idOrden,
        nombre: (raw.nombre || '').toString().toUpperCase(),
        apellido: (raw.apellido || '').toString().toUpperCase(),
        telefono: (raw.telefono || '').toString(),
        tipoArticulo: (raw.tipoArticulo || raw.tipo_articulo || '').toString().toUpperCase(),
        tipo_articulo: (raw.tipoArticulo || raw.tipo_articulo || '').toString().toUpperCase(),
        marca: (raw.marca || '').toString().toUpperCase(),
        modelo: (raw.modelo || '').toString().toUpperCase(),
        serie: (raw.serie || '').toString().toUpperCase(),
        falla: (raw.falla || '').toString().toUpperCase(),
        estado: normalizarEstado(raw.estado),
        detallePresupuesto: detalle,
        detalle_presupuesto: detalle,
        precioPresupuesto: precio,
        precio_presupuesto: precio,
        fueReparado: fueRep,
        fue_reparado: fueRep,
        fotos: Array.isArray(raw.fotos) ? raw.fotos : [],
        created_at: raw.created_at || new Date().toISOString()
    };
}

function formatearPrecioFijo(precioRaw) {
    const limpio = String(precioRaw || '').replace(/\D/g, '');
    if (!limpio) return '0';
    return Number(limpio).toLocaleString('es-AR');
}

function normalizarPrecioGuardado(precioRaw) {
    const txt = String(precioRaw ?? '').trim();
    if (!txt) return '';
    const limpio = txt.replace(/\D/g, '');
    if (!limpio) return '';
    return formatearPrecioFijo(limpio);
}

function limpiarNumeroTelefonoFijo(telRaw) {
    const num = String(telRaw || '').replace(/\D/g, '');
    if (!num) return '';
    if (num.indexOf('54') === 0) return num;
    return '54' + num;
}

function limpiarImporteEntero(raw) {
    const limpio = String(raw || '').replace(/\D/g, '');
    if (!limpio) return 0;
    return Number(limpio);
}

function formatearNumeroEntero(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('es-AR');
}

function limpiarCantidadEntera(raw) {
    const limpio = String(raw || '').replace(/\D/g, '');
    if (!limpio) return 0;
    return Number(limpio);
}

function totalItemsVenta() {
    return itemsVentaActual.reduce((acc, it) => acc + ((it.cantidad || 0) * (it.precioUnitario || 0)), 0);
}

function totalFinalVenta() {
    if (Number.isFinite(totalVentaManualOverride) && totalVentaManualOverride > 0) {
        return totalVentaManualOverride;
    }
    return totalItemsVenta();
}

function actualizarInputTotalFinal() {
    if (!ventaTotalFinal) return;

    const auto = totalItemsVenta();
    const total = totalFinalVenta();
    const mostrar = total || auto;

    if (document.activeElement === ventaTotalFinal) return;
    ventaTotalFinal.value = mostrar ? formatearNumeroEntero(mostrar) : '0';
}

function dibujarTablaItemsVenta() {
    if (!tablaItemsBody) return;

    if (!itemsVentaActual.length) {
        tablaItemsBody.innerHTML = '<tr class="tabla-items-vacio"><td colspan="4">Todavia no agregaste items.</td></tr>';
        if (tablaTotalGeneralValor) tablaTotalGeneralValor.textContent = '0';
        actualizarInputTotalFinal();
        return;
    }

    tablaItemsBody.innerHTML = itemsVentaActual
        .map((it) => {
            const total = (it.cantidad || 0) * (it.precioUnitario || 0);
            return (
                `<tr>` +
                    `<td>${formatearNumeroEntero(it.cantidad)}</td>` +
                    `<td>${it.descripcion}</td>` +
                    `<td>$${formatearNumeroEntero(it.precioUnitario)}</td>` +
                    `<td>$${formatearNumeroEntero(total)}</td>` +
                `</tr>`
            );
        })
        .join('');

    if (tablaTotalGeneralValor) tablaTotalGeneralValor.textContent = formatearNumeroEntero(totalItemsVenta());
    actualizarInputTotalFinal();
}

function limpiarCamposItemVenta() {
    if (ventaCantidad) ventaCantidad.value = '';
    if (ventaDescripcion) ventaDescripcion.value = '';
    if (ventaImporte) ventaImporte.value = '';
}

function intentarConstruirItemDesdeInputs() {
    const cantidadInput = limpiarCantidadEntera(ventaCantidad ? ventaCantidad.value : '');
    const descripcionInput = String(ventaDescripcion ? ventaDescripcion.value : '').trim();
    const precioUnitario = limpiarImporteEntero(ventaImporte ? ventaImporte.value : '');

    if (!precioUnitario) return null;

    const cantidad = cantidadInput || 1;
    const descripcion = descripcionInput || 'Consumidor final';
    return { cantidad, descripcion, precioUnitario };
}

async function agregarItemDesdeInputs() {
    const item = intentarConstruirItemDesdeInputs();
    if (!item) {
        await uiAlert('Completa el precio unitario para agregar el item.', { title: 'Dato faltante' });
        return false;
    }

    itemsVentaActual.push(item);
    dibujarTablaItemsVenta();
    limpiarCamposItemVenta();
    if (ventaCantidad) ventaCantidad.focus();
    return true;
}

function formatearFechaMov(fechaIso) {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearFechaDia(fechaIso) {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleDateString('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function claveDiaLocal(fechaIso) {
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return '';
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function obtenerNombreCliente(rep) {
    const partes = [rep && rep.apellido, rep && rep.nombre]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    return partes.join(', ') || 'Cliente sin nombre';
}

function obtenerNombreContacto(rep) {
    const partes = [rep && rep.nombre, rep && rep.apellido]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    const nombre = partes.join(' ')
        .toLocaleLowerCase('es-AR')
        .replace(/(^|[\s'-])\p{L}/gu, (letra) => letra.toLocaleUpperCase('es-AR'));
    return `Myb ${nombre || 'Cliente'}`;
}

function obtenerDescripcionEquipo(rep) {
    const partes = [
        rep && (rep.tipoArticulo || rep.tipo_articulo),
        rep && rep.marca,
        rep && rep.modelo
    ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    return partes.join(' ') || 'Equipo sin detalle';
}

function claveMesLocal(valorFecha) {
    const fecha = valorFecha instanceof Date ? valorFecha : new Date(valorFecha);
    if (Number.isNaN(fecha.getTime())) return '';
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function formatearMesCaja(claveMes) {
    const partes = String(claveMes || '').split('-');
    const y = Number(partes[0]);
    const m = Number(partes[1]);
    if (!y || !m) return 'Mes actual';
    const texto = new Date(y, m - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric'
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function obtenerMesesCaja() {
    const fechas = [];
    const listas = [cajaState.historialNegocio, cajaState.historialReparaciones];

    for (const listaItems of listas) {
        for (const item of (Array.isArray(listaItems) ? listaItems : [])) {
            const fecha = item && item.fecha ? new Date(item.fecha) : null;
            if (fecha && !Number.isNaN(fecha.getTime())) fechas.push(fecha);
        }
    }

    for (const rep of (Array.isArray(reparaciones) ? reparaciones : [])) {
        const fecha = rep && rep.created_at ? new Date(rep.created_at) : null;
        if (fecha && !Number.isNaN(fecha.getTime())) fechas.push(fecha);
    }

    const hoy = new Date();
    const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    let primerMes = mesActual;

    if (fechas.length) {
        const primeraFecha = fechas.reduce((min, fecha) => fecha < min ? fecha : min, fechas[0]);
        primerMes = new Date(primeraFecha.getFullYear(), primeraFecha.getMonth(), 1);
    }

    const meses = [];
    for (
        let fecha = new Date(primerMes.getFullYear(), primerMes.getMonth(), 1);
        fecha <= mesActual;
        fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1)
    ) {
        meses.push(claveMesLocal(fecha));
    }

    if (cajaMesSeleccionado && !meses.includes(cajaMesSeleccionado)) {
        meses.push(cajaMesSeleccionado);
    }
    return meses.filter(Boolean).sort((a, b) => b.localeCompare(a));
}

function renderSelectorMesCaja() {
    if (!cajaMesToggle || !cajaMesLabel || !cajaMesOpciones) return;
    const meses = obtenerMesesCaja();
    cajaMesLabel.textContent = formatearMesCaja(cajaMesSeleccionado);
    cajaMesOpciones.innerHTML = '';

    for (const mes of meses) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'caja-mes-opcion';
        btn.textContent = formatearMesCaja(mes);
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(mes === cajaMesSeleccionado));
        btn.addEventListener('click', () => {
            seleccionarMesCaja(mes);
        });
        cajaMesOpciones.appendChild(btn);
    }
}

function cerrarSelectorMesCaja() {
    if (!cajaMesToggle || !cajaMesOpciones) return;
    cajaMesOpciones.classList.add('hidden');
    cajaMesToggle.setAttribute('aria-expanded', 'false');
}

function alternarSelectorMesCaja() {
    if (!cajaMesToggle || !cajaMesOpciones) return;
    const abrir = cajaMesOpciones.classList.contains('hidden');
    cajaMesOpciones.classList.toggle('hidden', !abrir);
    cajaMesToggle.setAttribute('aria-expanded', String(abrir));
}

function seleccionarMesCaja(mes) {
    cajaMesSeleccionado = mes || claveMesLocal(new Date());
    cajaVista.negocio.mostrarTodosLosDias = false;
    cajaVista.negocio.diaSeleccionado = null;
    cajaVista.reparaciones.mostrarTodosLosDias = false;
    cajaVista.reparaciones.diaSeleccionado = null;
    cerrarSelectorMesCaja();
    renderCaja();
}

function filtrarMovimientosPorMes(items, claveMes) {
    return (Array.isArray(items) ? items : []).filter((item) => (
        claveMesLocal(item && item.fecha ? item.fecha : '') === claveMes
    ));
}

function sumarImportes(items) {
    return (Array.isArray(items) ? items : []).reduce((acc, item) => {
        return acc + Number(item && item.importe ? item.importe : 0);
    }, 0);
}

function agruparMovimientosPorDia(items) {
    const mapa = new Map();
    for (const item of (Array.isArray(items) ? items : [])) {
        const fechaIso = item && item.fecha ? item.fecha : '';
        const key = claveDiaLocal(fechaIso);
        if (!key) continue;
        if (!mapa.has(key)) {
            mapa.set(key, {
                key,
                fechaIso,
                total: 0,
                cantidad: 0,
                items: []
            });
        }
        const grp = mapa.get(key);
        const importe = Number(item && item.importe ? item.importe : 0);
        grp.total += importe;
        grp.cantidad += 1;
        grp.items.push(item);
    }

    const grupos = Array.from(mapa.values());
    for (const grp of grupos) {
        grp.items.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
        grp.label = formatearFechaDia(grp.fechaIso);
    }
    grupos.sort((a, b) => b.key.localeCompare(a.key));
    return grupos;
}

function normalizarTextoBusqueda(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function actualizarSugerenciasDescripcion() {
    if (!listaArticulos || !ventaDescripcion) return;
    const q = normalizarTextoBusqueda(ventaDescripcion.value);
    const maxSugerencias = 30;

    let opciones = [];
    if (!q) {
        opciones = OPCIONES_BASE_DESCRIPCION.slice();
    } else {
        const starts = [];
        const contains = [];
        for (const item of catalogoArticulos) {
            const normal = normalizarTextoBusqueda(item);
            if (!normal) continue;
            if (normal.startsWith(q)) {
                starts.push(item);
            } else if (normal.includes(q)) {
                contains.push(item);
            }
            if ((starts.length + contains.length) >= maxSugerencias) break;
        }
        opciones = starts.concat(contains).slice(0, maxSugerencias);
        if (!opciones.length) opciones = ['+Agregar descripción'];
    }

    listaArticulos.innerHTML = '';
    for (const op of opciones) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'lista-articulos-item';
        item.textContent = op;
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => {
            if (op === '+Agregar descripción') {
                ventaDescripcion.value = '';
                ventaDescripcion.focus();
                actualizarSugerenciasDescripcion();
                return;
            }
            ventaDescripcion.value = op;
            listaArticulos.classList.add('hidden');
            ventaImporte.focus();
        });
        listaArticulos.appendChild(item);
    }
}

async function cargarCatalogoArticulos() {
    try {
        const res = await fetch(CATALOGO_ARTICULOS_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        catalogoArticulos = data
            .map((v) => String(v || '').trim())
            .filter(Boolean);

        actualizarSugerenciasDescripcion();
    } catch (_err) {
        // noop
    }
}

function dibujarHistorialCaja(contenedor, items, textoVacio, tipoCaja) {
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
        contenedor.innerHTML = `<div class="historial-item-vacio">${textoVacio}</div>`;
        return;
    }

    const vista = cajaVista[tipoCaja];
    if (!vista) return;

    const grupos = agruparMovimientosPorDia(items);
    if (!grupos.length) {
        contenedor.innerHTML = `<div class="historial-item-vacio">${textoVacio}</div>`;
        return;
    }

    const grupoSeleccionado = vista.diaSeleccionado
        ? grupos.find((g) => g.key === vista.diaSeleccionado)
        : null;

    if (grupoSeleccionado) {
        const topBtn = document.createElement('button');
        topBtn.type = 'button';
        topBtn.className = 'historial-toggle-btn';
        topBtn.textContent = 'Ver menos';
        topBtn.addEventListener('click', () => {
            vista.diaSeleccionado = null;
            renderCaja();
        });
        contenedor.appendChild(topBtn);

        const titulo = document.createElement('div');
        titulo.className = 'historial-dia-titulo';
        titulo.textContent = `${grupoSeleccionado.label} - ${grupoSeleccionado.cantidad} venta(s)`;
        contenedor.appendChild(titulo);

        for (const item of grupoSeleccionado.items) {
            const descripcion = item && item.descripcion ? item.descripcion : 'Sin descripcion';
            const monto = formatearNumeroEntero(item && item.importe ? item.importe : 0);
            const fecha = formatearFechaMov(item && item.fecha ? item.fecha : '');

            const row = document.createElement('div');
            row.className = 'historial-item';
            const contenido = document.createElement('div');
            contenido.className = 'historial-item-content';
            contenido.innerHTML =
                `<div class="historial-item-top">` +
                    `<span class="historial-item-monto">+$${monto}</span>` +
                    `<span class="historial-item-fecha">${fecha}</span>` +
                `</div>` +
                `<div class="historial-item-descripcion">${descripcion}</div>`;

            const acciones = document.createElement('div');
            acciones.className = 'historial-item-actions';

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'historial-item-btn historial-item-btn-edit';
            btnEditar.appendChild(createIconSvg([
                'M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25z',
                'M14.06 4.19l3.75 3.75'
            ]));
            btnEditar.title = 'Editar venta';
            btnEditar.setAttribute('aria-label', 'Editar venta');
            btnEditar.addEventListener('click', async () => {
                await editarMovimientoCaja(tipoCaja, item);
            });

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'historial-item-btn historial-item-btn-delete';
            btnEliminar.appendChild(createIconSvg([
                'M4 7h16',
                'M9 7V5h6v2',
                'M7 7l1 12h8l1-12',
                'M10 11v6',
                'M14 11v6'
            ]));
            btnEliminar.title = 'Eliminar venta';
            btnEliminar.setAttribute('aria-label', 'Eliminar venta');
            btnEliminar.addEventListener('click', async () => {
                await eliminarMovimientoCaja(tipoCaja, item);
            });

            acciones.appendChild(btnEditar);
            acciones.appendChild(btnEliminar);
            row.appendChild(contenido);
            row.appendChild(acciones);
            contenedor.appendChild(row);
        }

        const bottomBtn = document.createElement('button');
        bottomBtn.type = 'button';
        bottomBtn.className = 'historial-toggle-btn';
        bottomBtn.textContent = 'Ver menos';
        bottomBtn.addEventListener('click', () => {
            vista.diaSeleccionado = null;
            renderCaja();
        });
        contenedor.appendChild(bottomBtn);
        return;
    }

    const gruposVisibles = vista.mostrarTodosLosDias ? grupos : grupos.slice(0, 2);
    for (const grp of gruposVisibles) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'historial-dia-btn';
        btn.innerHTML =
            `<span class="historial-dia-fecha">${grp.label}</span>` +
            `<span class="historial-dia-resumen">${grp.cantidad} venta(s) - $${formatearNumeroEntero(grp.total)}</span>`;
        btn.addEventListener('click', () => {
            vista.diaSeleccionado = grp.key;
            renderCaja();
        });
        contenedor.appendChild(btn);
    }

    if (grupos.length > 2) {
        const btnMas = document.createElement('button');
        btnMas.type = 'button';
        btnMas.className = 'historial-toggle-btn';
        btnMas.textContent = vista.mostrarTodosLosDias ? 'Ver menos dias' : 'Ver mas';
        btnMas.addEventListener('click', () => {
            vista.mostrarTodosLosDias = !vista.mostrarTodosLosDias;
            renderCaja();
        });
        contenedor.appendChild(btnMas);
    }
}

async function editarMovimientoCaja(caja, item) {
    const id = String(item && item.id ? item.id : '').trim();
    if (!id) {
        await uiAlert('No se pudo editar: movimiento sin id.', { title: 'Error' });
        return;
    }

    const descripcionActual = String(item && item.descripcion ? item.descripcion : '');
    const desc = await uiPrompt('Editar descripcion de la venta:', descripcionActual, { title: 'Editar venta' });
    if (desc === null) return;

    const importeActual = formatearNumeroEntero(item && item.importe ? item.importe : 0);
    const impInput = await uiPrompt('Editar importe de la venta:', importeActual, { title: 'Editar venta' });
    if (impInput === null) return;

    const nuevoImporte = limpiarImporteEntero(impInput);
    if (!nuevoImporte) {
        await uiAlert('El importe debe ser mayor que 0.', { title: 'Dato invalido' });
        return;
    }

    try {
        await datastore.updateFinanceMovement({
            caja,
            id,
            descripcion: String(desc || '').trim() || 'Sin descripcion',
            importe: nuevoImporte
        });
        await cargarCaja();
    } catch (err) {
        console.error('No se pudo editar la venta:', err);
        const msg = String(err && (err.message || err.name || err));
        await uiAlert('No se pudo editar la venta: ' + msg, { title: 'Error' });
    }
}

async function eliminarMovimientoCaja(caja, item) {
    const id = String(item && item.id ? item.id : '').trim();
    if (!id) {
        await uiAlert('No se pudo eliminar: movimiento sin id.', { title: 'Error' });
        return;
    }

    const ok = await uiConfirm('Seguro que queres eliminar esta venta de caja?', {
        title: 'Eliminar venta',
        okText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
    });
    if (!ok) return;

    try {
        await datastore.deleteFinanceMovement({ caja, id });
        await cargarCaja();
    } catch (err) {
        console.error('No se pudo eliminar la venta:', err);
        const msg = String(err && (err.message || err.name || err));
        await uiAlert('No se pudo eliminar la venta: ' + msg, { title: 'Error' });
    }
}
function renderCaja() {
    const historialNegocioMes = filtrarMovimientosPorMes(cajaState.historialNegocio, cajaMesSeleccionado);
    const historialReparacionesMes = filtrarMovimientosPorMes(cajaState.historialReparaciones, cajaMesSeleccionado);
    const mesLabel = formatearMesCaja(cajaMesSeleccionado);

    renderSelectorMesCaja();

    if (totalCobrarNegocio) totalCobrarNegocio.textContent = formatearNumeroEntero(cajaState.cajaNegocioTotal);
    if (totalCajaNegocio) totalCajaNegocio.textContent = formatearNumeroEntero(sumarImportes(historialNegocioMes));
    if (totalCajaReparaciones) totalCajaReparaciones.textContent = formatearNumeroEntero(sumarImportes(historialReparacionesMes));

    dibujarHistorialCaja(historialCobrarNegocio, cajaState.historialNegocio, 'Todavia no hay ventas registradas.', 'negocio');
    dibujarHistorialCaja(historialCajaNegocio, historialNegocioMes, `Todavia no hay movimientos en Caja Negocio para ${mesLabel}.`, 'negocio');
    dibujarHistorialCaja(historialCajaReparaciones, historialReparacionesMes, `Todavia no hay movimientos en Caja Reparaciones para ${mesLabel}.`, 'reparaciones');
}

async function cargarCaja() {
    try {
        const data = await datastore.getFinanceState();
        cajaState = {
            cajaNegocioTotal: Number(data && data.cajaNegocioTotal) || 0,
            cajaReparacionesTotal: Number(data && data.cajaReparacionesTotal) || 0,
            historialNegocio: Array.isArray(data && data.historialNegocio) ? data.historialNegocio : [],
            historialReparaciones: Array.isArray(data && data.historialReparaciones) ? data.historialReparaciones : []
        };
    } catch (_err) {
        cajaState = {
            cajaNegocioTotal: 0,
            cajaReparacionesTotal: 0,
            historialNegocio: [],
            historialReparaciones: []
        };
        console.error('No se pudo cargar caja:', _err);
    }
    renderCaja();
}

async function agregarMovimientoCaja({ caja, descripcion, importe, origen, ordenId }) {
    const monto = limpiarImporteEntero(importe);
    if (!monto) return;

    await datastore.appendFinanceMovement({
        caja,
        descripcion,
        importe: monto,
        origen,
        ordenId
    });
    await cargarCaja();
}

function mostrarSeccion(nombre) {
    seccionActual = nombre;

    vistaCobrar.classList.toggle('hidden', nombre !== 'cobrar');
    vistaReparaciones.classList.toggle('hidden', nombre !== 'reparaciones');
    vistaCaja.classList.toggle('hidden', nombre !== 'caja');

    menuCobrar.classList.toggle('activo', nombre === 'cobrar');
    menuReparaciones.classList.toggle('activo', nombre === 'reparaciones');
    menuCaja.classList.toggle('activo', nombre === 'caja');

    menuCobrar.setAttribute('aria-selected', String(nombre === 'cobrar'));
    menuReparaciones.setAttribute('aria-selected', String(nombre === 'reparaciones'));
    menuCaja.setAttribute('aria-selected', String(nombre === 'caja'));
}

async function migrarOrdenesSiHaceFalta(items) {
    let maxNumerico = 0;
    let huboCambios = false;

    for (const it of items) {
        const n = extraerNumeroOrden(it);
        if (n && n > maxNumerico) maxNumerico = n;
    }

    for (const it of items) {
        const actual = extraerNumeroOrden(it);
        if (actual) {
            if (Number(it.idOrden) !== actual) {
                await datastore.updateOrder(it.id, { idOrden: actual });
                it.idOrden = actual;
                huboCambios = true;
            }
            continue;
        }

        maxNumerico += 1;
        await datastore.updateOrder(it.id, { idOrden: maxNumerico });
        it.idOrden = maxNumerico;
        huboCambios = true;
    }

    proximoNumeroOrden = maxNumerico + 1;
    return huboCambios;
}

async function aplicarOrdenes(items, { migrar = true } = {}) {
    const fotosAnteriores = new Map(reparaciones.map((rep) => [String(rep.id), rep.fotos || []]));
    const normalizados = (items || []).map((it, idx) => {
        const orden = normalizarOrden(it, idx);
        if (!orden.fotos.length) orden.fotos = fotosAnteriores.get(String(orden.id)) || [];
        return orden;
    });
    const urlsEntrantes = new Set(normalizados
        .flatMap((item) => Array.isArray(item.fotos) ? item.fotos : [])
        .filter((url) => typeof url === 'string' && url.startsWith('blob:')));
    liberarBlobUrlsRenderizados(urlsEntrantes);
    reparaciones = normalizados;
    agregarContactosAgendaDesdeOrdenes(reparaciones);
    blobUrlsRenderizados = reparaciones
        .flatMap((r) => Array.isArray(r.fotos) ? r.fotos : [])
        .filter((url) => typeof url === 'string' && url.startsWith('blob:'));

    const numeros = reparaciones
        .map((it) => extraerNumeroOrden(it))
        .filter((n) => Number.isFinite(n));
    proximoNumeroOrden = (numeros.length ? Math.max(...numeros) : 0) + 1;

    dibujarLista();
    renderCaja();

    // La migracion no debe demorar el primer dibujo de la pantalla.
    if (migrar) await migrarOrdenesSiHaceFalta(normalizados);
}

async function fetchAndRender() {
    const items = await datastore.getOrders();
    await aplicarOrdenes(items);
}

async function cargarOrdenesIniciales() {
    try {
        const cache = await datastore.getCachedOrders();
        if (Array.isArray(cache) && cache.length) {
            await aplicarOrdenes(cache, { migrar: false });
        }
    } catch (err) {
        console.warn('No se pudo mostrar la cache local de ordenes:', err);
    }

    // La sincronizacion completa (incluidas las fotos) avanza en paralelo.
    let sincronizacionCompletaFinalizada = false;
    const sincronizacionCompleta = fetchAndRenderSafe('sincronizar ordenes iniciales')
        .finally(() => { sincronizacionCompletaFinalizada = true; });

    try {
        const resumenNube = await datastore.getOrdersPreview();
        if (!sincronizacionCompletaFinalizada && Array.isArray(resumenNube)) {
            const fotosCacheadas = new Map(reparaciones.map((rep) => [String(rep.id), rep.fotos || []]));
            const resumenConFotosCacheadas = resumenNube.map((rep) => Object.assign({}, rep, {
                fotos: fotosCacheadas.get(String(rep.id)) || []
            }));
            await aplicarOrdenes(resumenConFotosCacheadas, { migrar: false });
        }
    } catch (err) {
        console.warn('No se pudo mostrar el resumen de ordenes:', err);
    }

    return sincronizacionCompleta;
}

function actualizarContadores() {
    let cAceptada = 0;
    let cPresupuesto = 0;
    let cTaller = 0;
    let cTerminada = 0;
    let cArchivada = 0;

    for (const rep of reparaciones) {
        if (rep.estado === 'Aceptada') cAceptada += 1;
        if (rep.estado === 'Presupuestada') cPresupuesto += 1;
        if (rep.estado === 'En Reparación') cTaller += 1;
        if (rep.estado === 'Terminada') cTerminada += 1;
        if (rep.estado === 'Archivada') cArchivada += 1;
    }

    cantAceptada.textContent = String(cAceptada);
    cantPresupuesto.textContent = String(cPresupuesto);
    cantTaller.textContent = String(cTaller);
    cantTerminada.textContent = String(cTerminada);
    cantArchivada.textContent = String(cArchivada);

    if (menuBadgeReparaciones) {
        const totalActivas = cAceptada + cPresupuesto + cTaller + cTerminada;
        menuBadgeReparaciones.textContent = String(totalActivas);
        try {
            localStorage.setItem(REPARACIONES_BADGE_CACHE_KEY, String(totalActivas));
        } catch (_err) {
            // El contador visual igualmente queda actualizado.
        }
    }
}

function activarPestana(estado) {
    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('activo'));

    if (estado === 'Aceptada') tabAceptada.classList.add('activo');
    if (estado === 'Presupuestada') tabPresupuesta.classList.add('activo');
    if (estado === 'En Reparación') tabTaller.classList.add('activo');
    if (estado === 'Terminada') tabTerminada.classList.add('activo');
    if (estado === 'Archivada') tabArchivada.classList.add('activo');
}

function dibujarLista() {
    actualizarContadores();
    lista.innerHTML = '';

    const q = String(buscar.value || '').trim().toLowerCase();

    const filtradas = reparaciones.filter((rep) => {
        if (rep.estado !== estadoActualFiltrado) return false;
        if (!q) return true;
        return (`${rep.nombre} ${rep.apellido} ${rep.telefono} ${rep.tipoArticulo || rep.tipo_articulo || ''} ${rep.marca} ${rep.modelo} ${extraerNumeroOrden(rep) || ''}`).toLowerCase().includes(q);
    });

    if (!filtradas.length) {
        lista.innerHTML = `<p style="text-align:center; color:#7f8c8d; background: white; padding: 20px; border-radius: 8px;">No hay ordenes en la seccion de "${estadoActualFiltrado}".</p>`;
        return;
    }

    for (const rep of filtradas) {
        const div = document.createElement('div');
        const claseBorde = rep.estado === 'En Reparación' ? 'En-Reparacion' : rep.estado;
        div.className = 'registro borde-' + claseBorde.replace(/ /g, '-');

        const nSerie = rep.serie
            ? `<p><b>S/N u IMEI:</b> <span class="dato-resaltado">${rep.serie}</span></p>`
            : '';

        let bloquePresupuesto = '';
        if (rep.estado === 'Archivada') {
            bloquePresupuesto = rep.fueReparado === false
                ? '<div class="txt-entregado">DEVUELTO AL CLIENTE SIN ARREGLO DE FORMA DEFINITIVA.</div>'
                : `<div class="txt-entregado">ENTREGADO AL CLIENTE Y COBRADO LA SUMA DE $${rep.precioPresupuesto || rep.precio_presupuesto || ''}</div>`;
        } else if (rep.fueReparado === false) {
            bloquePresupuesto = '<div class="txt-rechazado">NO REPARADO: EL CLIENTE RECHAZO EL PRESUPUESTO TECNICO. LISTO PARA DEVOLVER.</div>';
        } else if ((rep.detallePresupuesto || rep.detalle_presupuesto) || (rep.precioPresupuesto || rep.precio_presupuesto)) {
            bloquePresupuesto =
                `<div class="txt-presupuesto">` +
                `FALLA DETECTADA: <span class="dato-resaltado">${rep.detallePresupuesto || rep.detalle_presupuesto || ''}</span><br>` +
                `COSTO DE REPARACION: <span class="dato-resaltado">$${rep.precioPresupuesto || rep.precio_presupuesto || ''}</span>` +
                `</div>`;
        }

        let bloqueFotos = '';
        if (rep.fotos && rep.fotos.length > 0) {
            bloqueFotos = '<div class="galeria-fotos">' +
                rep.fotos.map((url) => `<div class="foto-contenedor"><img src="${url}" class="foto-miniatura" data-url="${url}"></div>`).join('') +
                '</div>';
        }

        let botoneraFlujo = '';
        if (rep.estado === 'Aceptada') {
            botoneraFlujo = '<button class="btn-flujo" data-action="presupuestar" style="background-color:#9b59b6;">Presupuestar Equipo</button>';
        } else if (rep.estado === 'Presupuestada') {
            botoneraFlujo =
                '<button class="btn-flujo" data-action="acepto" style="background-color:#f39c12; margin-right:5px;">Cliente Acepto (Ir a Taller)</button>' +
                '<button class="btn-flujo" data-action="rechazo" style="background-color:#e67e22;">Cliente NO Acepto</button>';
        } else if (rep.estado === 'En Reparación') {
            botoneraFlujo = '<button class="btn-flujo" data-action="terminada" style="background-color:#2ecc71;">Trabajo Listo para Retirar</button>';
        } else if (rep.estado === 'Terminada') {
            botoneraFlujo = '<button class="btn-flujo" data-action="archivar" style="background-color:#16a085;">MARCAR COMO ENTREGADO Y COBRADO</button>';
        } else if (rep.estado === 'Archivada') {
            botoneraFlujo = '<span style="color:#7f8c8d; font-size:13px; padding-top:6px;">TRABAJO FINALIZADO Y GUARDADO EN HISTORIAL</span>';
        }

        const nroOrden = extraerNumeroOrden(rep) || rep.idOrden || rep.id;
        const cliente = obtenerNombreCliente(rep);
        const equipo = obtenerDescripcionEquipo(rep);

        div.innerHTML =
            `<div class="cliente"><span class="dato-resaltado">${cliente}</span> <span class="num-orden">Orden N° ${nroOrden}</span></div>` +
            `<p><b>TELEFONO:</b> ${rep.telefono || 'No registrado'}</p>` +
            `<p><b>EQUIPO:</b> <span class="dato-resaltado">${equipo}</span></p>` +
            nSerie +
            `<p><b>PROBLEMA INICIAL:</b> <span class="dato-resaltado">${rep.falla}</span></p>` +
            bloquePresupuesto +
            bloqueFotos +
            `<div class="acciones">` +
                botoneraFlujo +
                `<button class="btn-whatsapp" data-action="whatsapp">Enviar WhatsApp</button>` +
                `<button class="btn-editar" data-action="editar">Editar</button>` +
                `<button class="btn-borrar" data-action="eliminar">Eliminar</button>` +
            `</div>`;

        lista.appendChild(div);

        div.querySelectorAll('.foto-miniatura').forEach((img, idx) => {
            img.addEventListener('click', () => openPhotoViewer(rep.fotos || [], idx));
        });

        div.querySelector('[data-action="whatsapp"]').addEventListener('click', () => {
            enviarWhatsAppDirecto(rep);
        });

        div.querySelector('[data-action="editar"]').addEventListener('click', async () => {
            await editarOrden(rep);
        });

        div.querySelector('[data-action="eliminar"]').addEventListener('click', async () => {
            await eliminarOrden(rep.id);
        });

        div.querySelectorAll('.btn-flujo[data-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-action');
                if (action === 'presupuestar') await abrirCargaPresupuesto(rep);
                if (action === 'acepto') await cambiarEstadoConAviso(rep, 'En Reparación');
                if (action === 'rechazo') await rechazarPresupuestoFijo(rep);
                if (action === 'terminada') await cambiarEstadoConAviso(rep, 'Terminada');
                if (action === 'archivar') await entregarEquipoFijo(rep);
            });
        });
    }
}

function openPhotoViewer(photos, index) {
    if (!Array.isArray(photos) || photos.length === 0) return;
    viewerPhotos = photos;
    viewerCurrent = Math.max(0, Math.min(index, photos.length - 1));
    resetViewerTransform();
    updateViewer();
    photoViewer.classList.remove('hidden');
}

function updateViewer() {
    if (!viewerPhotos.length) return;
    viewerImage.src = viewerPhotos[viewerCurrent];
    resetViewerTransform();
    viewerIndex.textContent = String(viewerCurrent + 1);
    viewerTotal.textContent = String(viewerPhotos.length);
}

function resetViewerTransform() {
    viewerScale = 1;
    viewerTranslateX = 0;
    viewerTranslateY = 0;
    applyViewerTransform();
}

function applyViewerTransform() {
    viewerImage.style.transform = `translate(${viewerTranslateX}px, ${viewerTranslateY}px) scale(${viewerScale})`;
}

function distanciaEntreToques(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt((dx * dx) + (dy * dy));
}

viewerClose.addEventListener('click', () => photoViewer.classList.add('hidden'));
viewerPrev.addEventListener('click', () => {
    if (viewerCurrent > 0) {
        viewerCurrent -= 1;
        updateViewer();
    }
});
viewerNext.addEventListener('click', () => {
    if (viewerCurrent < viewerPhotos.length - 1) {
        viewerCurrent += 1;
        updateViewer();
    }
});
photoViewer.addEventListener('click', (event) => {
    if (event.target === photoViewer) photoViewer.classList.add('hidden');
});

viewerImage.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
        isPinching = true;
        pinchStartDistance = distanciaEntreToques(event.touches[0], event.touches[1]);
        pinchStartScale = viewerScale;
        return;
    }

    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    if (viewerScale > 1) {
        panStartX = event.touches[0].clientX;
        panStartY = event.touches[0].clientY;
        panStartTranslateX = viewerTranslateX;
        panStartTranslateY = viewerTranslateY;
    }
});
viewerImage.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2) {
        event.preventDefault();
        const dist = distanciaEntreToques(event.touches[0], event.touches[1]);
        if (!pinchStartDistance) pinchStartDistance = dist;
        const rawScale = (dist / pinchStartDistance) * pinchStartScale;
        viewerScale = Math.min(4, Math.max(1, rawScale));
        applyViewerTransform();
        return;
    }

    if (event.touches.length === 1 && viewerScale > 1) {
        event.preventDefault();
        const dx = event.touches[0].clientX - panStartX;
        const dy = event.touches[0].clientY - panStartY;
        viewerTranslateX = panStartTranslateX + dx;
        viewerTranslateY = panStartTranslateY + dy;
        applyViewerTransform();
    }
}, { passive: false });
viewerImage.addEventListener('touchend', (event) => {
    if (isPinching && event.touches.length < 2) {
        isPinching = false;
        pinchStartDistance = 0;
        pinchStartScale = viewerScale;
        if (viewerScale <= 1.02) {
            resetViewerTransform();
        }
        return;
    }

    const now = Date.now();
    const tapX = event.changedTouches[0].clientX;
    const tapY = event.changedTouches[0].clientY;
    const dt = now - lastTapTime;
    const distTap = Math.hypot(tapX - lastTapX, tapY - lastTapY);

    if (dt > 0 && dt < 300 && distTap < 25) {
        if (viewerScale > 1) {
            resetViewerTransform();
        } else {
            viewerScale = 2.5;
            viewerTranslateX = 0;
            viewerTranslateY = 0;
            applyViewerTransform();
        }
        lastTapTime = 0;
        return;
    }

    lastTapTime = now;
    lastTapX = tapX;
    lastTapY = tapY;

    if (viewerScale > 1) return;

    touchEndX = event.changedTouches[0].clientX;
    touchEndY = event.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
        if (dx < 0 && viewerCurrent < viewerPhotos.length - 1) {
            viewerCurrent += 1;
            updateViewer();
        } else if (dx > 0 && viewerCurrent > 0) {
            viewerCurrent -= 1;
            updateViewer();
        }
    }
});

document.addEventListener('keydown', (event) => {
    if (photoViewer.classList.contains('hidden')) return;
    if (event.key === 'Escape') photoViewer.classList.add('hidden');
    if (event.key === 'ArrowLeft') viewerPrev.click();
    if (event.key === 'ArrowRight') viewerNext.click();
});

window.addEventListener('beforeunload', () => {
    limpiarFotosTemporalesIngreso();
    liberarBlobUrlsRenderizados();
});

function construirMensajeWhatsApp(rep) {
    const numeroOrden = extraerNumeroOrden(rep) || rep.idOrden || rep.id;
    const equipo = obtenerDescripcionEquipo(rep);

    if (rep.estado === 'Aceptada') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Tu equipo *${equipo}* ya fue ingresado correctamente bajo la orden de trabajo *N° ${numeroOrden}*. Queda a la espera de revision tecnico-diagnostica.`;
    }

    if (rep.estado === 'Presupuestada') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te adjuntamos el presupuesto para tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}*.\n\nFalla: *${rep.detallePresupuesto || rep.detalle_presupuesto || ''}*\nCosto: *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*\n\nPor favor, confirmanos si aprobas el presupuesto.`;
    }

    if (rep.estado === 'En Reparación') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te informamos que el presupuesto de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}* fue aprobado y tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}* ya se encuentra en proceso de reparacion.`;
    }

    if (rep.estado === 'Terminada' || rep.estado === 'Archivada') {
        if (rep.fueReparado === false) {
            return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te informamos que podes pasar a retirar tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}* que quedo devuelto sin arreglo.`;
        }

        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. El trabajo de tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}* ya esta listo. El costo de la reparacion es de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*. Podes pasar a retirarlo cuando gustes.`;
    }

    return `Hola *${rep.nombre}*, tenemos novedades sobre tu orden *N° ${numeroOrden}*.`;
}

function escaparValorVCard(valor) {
    return String(valor || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
}

function normalizarTelefonoAgenda(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function claveTelefonoAgenda(valor) {
    let telefono = normalizarTelefonoAgenda(valor);
    if (telefono.startsWith('549') && telefono.length > 10) telefono = telefono.slice(3);
    else if (telefono.startsWith('54') && telefono.length > 10) telefono = telefono.slice(2);
    if (telefono.startsWith('0')) telefono = telefono.slice(1);
    return telefono;
}

function normalizarContactoAgenda(raw) {
    const telefono = normalizarTelefonoAgenda(raw && raw.telefono);
    const clave = claveTelefonoAgenda(telefono);
    const nombreGuardado = String(raw && raw.nombre || '').trim();
    const nombrePersona = nombreGuardado.replace(/^myb(?:\s*-\s*|\s+)/i, '').trim();
    const nombre = `Myb ${nombrePersona || 'Cliente'}`;
    if (!clave) return null;
    return { nombre, telefono, clave };
}

function actualizarVistaAgendaVcf() {
    const cantidad = contactosAgendaPendientes.length;
    if (agendaVcfContador) {
        agendaVcfContador.textContent = String(cantidad);
        agendaVcfContador.hidden = cantidad === 0;
        agendaVcfContador.setAttribute('aria-label', `${cantidad} contactos pendientes`);
    }
    if (btnAgendaVcf) btnAgendaVcf.disabled = cantidad === 0;
    if (agendaVcfEstado) {
        agendaVcfEstado.textContent = cantidad === 0
            ? 'No hay contactos pendientes.'
            : `${cantidad} contacto${cantidad === 1 ? '' : 's'} listo${cantidad === 1 ? '' : 's'} para descargar.`;
    }
}

function guardarEstadoAgendaVcf() {
    try {
        localStorage.setItem(AGENDA_VCF_PENDIENTES_KEY, JSON.stringify(contactosAgendaPendientes));
        localStorage.setItem(AGENDA_VCF_REGISTRADOS_KEY, JSON.stringify(Array.from(telefonosAgendaRegistrados)));
        return true;
    } catch (err) {
        console.warn('No se pudo guardar la agenda VCF local:', err);
        return false;
    }
}

function cargarEstadoAgendaVcf() {
    contactosAgendaPendientes = [];
    telefonosAgendaRegistrados = new Set();

    try {
        const pendientesRaw = JSON.parse(localStorage.getItem(AGENDA_VCF_PENDIENTES_KEY) || '[]');
        const registradosRaw = JSON.parse(localStorage.getItem(AGENDA_VCF_REGISTRADOS_KEY) || '[]');
        const telefonosPendientes = new Set();

        if (Array.isArray(pendientesRaw)) {
            for (const raw of pendientesRaw) {
                const contacto = normalizarContactoAgenda(raw);
                if (!contacto || telefonosPendientes.has(contacto.clave)) continue;
                telefonosPendientes.add(contacto.clave);
                contactosAgendaPendientes.push(contacto);
            }
        }

        if (Array.isArray(registradosRaw)) {
            for (const raw of registradosRaw) {
                const telefono = claveTelefonoAgenda(raw);
                if (telefono) telefonosAgendaRegistrados.add(telefono);
            }
        }

        for (const contacto of contactosAgendaPendientes) {
            telefonosAgendaRegistrados.add(contacto.clave);
        }
    } catch (err) {
        console.warn('No se pudo recuperar la agenda VCF local:', err);
    }

    guardarEstadoAgendaVcf();
    actualizarVistaAgendaVcf();
}

function agregarContactoAgenda(rep, { guardar = true } = {}) {
    const contacto = normalizarContactoAgenda({
        nombre: obtenerNombreContacto(rep),
        telefono: rep && rep.telefono
    });
    if (!contacto || telefonosAgendaRegistrados.has(contacto.clave)) return false;

    contactosAgendaPendientes.push(contacto);
    telefonosAgendaRegistrados.add(contacto.clave);
    if (guardar) {
        guardarEstadoAgendaVcf();
        actualizarVistaAgendaVcf();
    }
    return true;
}

function agregarContactosAgendaDesdeOrdenes(ordenes) {
    let huboCambios = false;
    for (const rep of (Array.isArray(ordenes) ? ordenes : [])) {
        if (agregarContactoAgenda(rep, { guardar: false })) huboCambios = true;
    }
    if (huboCambios) guardarEstadoAgendaVcf();
    actualizarVistaAgendaVcf();
}

function construirVCardAgenda(contacto) {
    return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escaparValorVCard(contacto.nombre)}`,
        `TEL:${contacto.telefono}`,
        'END:VCARD'
    ].join('\r\n');
}

async function descargarAgendaVcf() {
    if (!contactosAgendaPendientes.length) {
        await uiAlert('No hay contactos nuevos para descargar.', { title: 'Agenda al dia' });
        return;
    }

    const cantidad = contactosAgendaPendientes.length;
    const contenido = contactosAgendaPendientes.map(construirVCardAgenda).join('\r\n') + '\r\n';
    const blob = new Blob([contenido], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agenda-myb-${claveDiaLocal(new Date())}.vcf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    contactosAgendaPendientes = [];
    guardarEstadoAgendaVcf();
    actualizarVistaAgendaVcf();
    await uiAlert(`Se descargaron ${cantidad} contacto${cantidad === 1 ? '' : 's'}. Abri el archivo VCF y toca Importar o Guardar. La lista pendiente quedo vacia.`, {
        title: 'Agenda descargada'
    });
}

function enviarWhatsAppDirecto(rep) {
    if (!rep.telefono) return;
    const numLimpio = limpiarNumeroTelefonoFijo(rep.telefono);
    const textoMensaje = construirMensajeWhatsApp(rep);
    const urlNativa = `whatsapp://send?phone=${numLimpio}&text=${encodeURIComponent(textoMensaje)}`;
    window.location.href = urlNativa;
}

async function cambiarEstadoConAviso(rep, nuevoEstado) {
    const upd = { estado: nuevoEstado };
    await datastore.updateOrder(rep.id, upd);
    estadoActualFiltrado = nuevoEstado;
    activarPestana(nuevoEstado);

    const actualizado = Object.assign({}, rep, upd);
    enviarWhatsAppDirecto(actualizado);
    await fetchAndRenderSafe('refrescar ordenes');
}

async function entregarEquipoFijo(rep) {
    const ok = await uiConfirm('Confirmas que el cliente pago y retiro el equipo? Ira a la pestaña de Archivadas.', {
        title: 'Confirmar entrega',
        okText: 'Si, confirmar',
        cancelText: 'Cancelar'
    });
    if (!ok) return;

    await datastore.updateOrder(rep.id, { estado: 'Archivada' });
    const montoCobrado = rep.fueReparado === false ? 0 : limpiarImporteEntero(rep.precioPresupuesto || rep.precio_presupuesto || 0);
    if (montoCobrado > 0) {
        const numeroOrden = extraerNumeroOrden(rep) || rep.idOrden || rep.id;
        const equipo = obtenerDescripcionEquipo(rep);
        await agregarMovimientoCaja({
            caja: 'reparaciones',
            descripcion: `Orden N° ${numeroOrden} - ${equipo}`,
            importe: montoCobrado,
            origen: 'reparacion',
            ordenId: rep.id
        });
    }

    if (rep.telefono) {
        const numLimpio = limpiarNumeroTelefonoFijo(rep.telefono);
        const numeroOrden = extraerNumeroOrden(rep) || rep.idOrden || rep.id;
        const equipo = obtenerDescripcionEquipo(rep);
        const textoCierre = rep.fueReparado === false
            ? `Hola *${rep.nombre}*, te confirmamos que tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}* fue retirado de nuestro local (Devuelto sin arreglo). Muchas gracias por confiar en *MyB Electronica*!`
            : `Hola *${rep.nombre}*, te confirmamos que tu equipo *${equipo}* bajo la orden de trabajo *N° ${numeroOrden}* fue entregado y cobrado correctamente la suma de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*. Muchas gracias por confiar en *MyB Electronica*!`;

        const urlCierre = `whatsapp://send?phone=${numLimpio}&text=${encodeURIComponent(textoCierre)}`;
        window.location.href = urlCierre;
    }

    estadoActualFiltrado = 'Terminada';
    activarPestana('Terminada');
    await fetchAndRenderSafe('refrescar ordenes');
}

async function abrirCargaPresupuesto(rep) {
    const detalle = await uiPrompt(
        'Cual es la falla real que encontraste en el diagnostico tecnico?',
        rep.detallePresupuesto || rep.detalle_presupuesto || '',
        { title: 'Cargar presupuesto', okText: 'Continuar' }
    );
    if (detalle === null) return;

    const precioInput = await uiPrompt(
        'Cual es el costo/precio final de esta reparacion? (No importa si no pones los puntos)',
        rep.precioPresupuesto || rep.precio_presupuesto || '',
        { title: 'Cargar presupuesto', okText: 'Guardar' }
    );
    if (precioInput === null) return;

    const upd = {
        detallePresupuesto: detalle.trim().toUpperCase(),
        detalle_presupuesto: detalle.trim().toUpperCase(),
        precioPresupuesto: formatearPrecioFijo(precioInput),
        precio_presupuesto: formatearPrecioFijo(precioInput),
        fueReparado: true,
        fue_reparado: true,
        estado: 'Presupuestada'
    };

    await datastore.updateOrder(rep.id, upd);

    estadoActualFiltrado = 'Presupuestada';
    activarPestana('Presupuestada');

    const actualizado = Object.assign({}, rep, upd);
    enviarWhatsAppDirecto(actualizado);

    await fetchAndRenderSafe('refrescar ordenes');
}

async function rechazarPresupuestoFijo(rep) {
    const ok = await uiConfirm('Marcar este equipo como rechazado por el cliente? Se enviara a terminadas sin costo y disparara el aviso.', {
        title: 'Rechazar presupuesto',
        okText: 'Si, rechazar',
        cancelText: 'Cancelar'
    });
    if (!ok) return;

    const upd = {
        fueReparado: false,
        fue_reparado: false,
        precioPresupuesto: '0',
        precio_presupuesto: '0',
        estado: 'Terminada'
    };

    await datastore.updateOrder(rep.id, upd);

    estadoActualFiltrado = 'Terminada';
    activarPestana('Terminada');

    const actualizado = Object.assign({}, rep, upd);
    enviarWhatsAppDirecto(actualizado);

    await fetchAndRenderSafe('refrescar ordenes');
}

async function guardarOrdenManual() {
    const nom = document.getElementById('nombre').value.trim();
    const ape = document.getElementById('apellido').value.trim();
    const tel = document.getElementById('telefono').value.trim();
    const tipo = document.getElementById('tipoArticulo').value.trim();
    const mar = document.getElementById('marca').value.trim();
    const mod = document.getElementById('modelo').value.trim();
    const ser = document.getElementById('serie').value.trim();
    const fal = document.getElementById('falla').value.trim();

    if (!nom || !tipo || !mar || !fal) {
        await uiAlert('Por favor, completa los campos obligatorios para ingresar el equipo.', { title: 'Dato faltante' });
        return;
    }

    const nuevoNumero = proximoNumeroOrden;
    const idInterno = `ord_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;

    const nuevaOrden = {
        id: idInterno,
        idOrden: nuevoNumero,
        nombre: nom.toUpperCase(),
        apellido: ape.toUpperCase(),
        telefono: tel,
        tipoArticulo: tipo.toUpperCase(),
        tipo_articulo: tipo.toUpperCase(),
        marca: mar.toUpperCase(),
        modelo: mod.toUpperCase(),
        serie: ser.toUpperCase(),
        falla: fal.toUpperCase(),
        estado: 'Aceptada',
        detallePresupuesto: '',
        detalle_presupuesto: '',
        precioPresupuesto: '',
        precio_presupuesto: '',
        fueReparado: true,
        fue_reparado: true,
        fotos: [],
        created_at: new Date().toISOString()
    };

    const files = fotosTemporalesIngreso.map((f) => f.file).filter(Boolean);
    await datastore.addOrder(nuevaOrden, files);
    agregarContactoAgenda(nuevaOrden);

    proximoNumeroOrden += 1;

    document.getElementById('nombre').value = '';
    document.getElementById('apellido').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('tipoArticulo').value = '';
    document.getElementById('marca').value = '';
    document.getElementById('modelo').value = '';
    document.getElementById('serie').value = '';
    document.getElementById('falla').value = '';

    limpiarFotosTemporalesIngreso();
    mostrarVistaPreviaIngreso();

    estadoActualFiltrado = 'Aceptada';
    activarPestana('Aceptada');

    enviarWhatsAppDirecto(nuevaOrden);
    await fetchAndRenderSafe('refrescar ordenes');
}

async function eliminarOrden(id) {
    const ok = await uiConfirm('Estas seguro de borrar este registro de forma permanente?', {
        title: 'Eliminar orden',
        okText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
    });
    if (!ok) return;
    await datastore.deleteOrder(id);
    await fetchAndRenderSafe('refrescar ordenes');
}

async function editarOrden(rep) {
    const cambios = await uiEditarOrden(rep);
    if (!cambios) return;

    try {
        await datastore.updateOrder(rep.id, cambios);
        await fetchAndRenderSafe('refrescar ordenes');
    } catch (err) {
        console.error('No se pudo editar la orden:', err);
        await uiAlert('No se pudo guardar la edicion: ' + obtenerMensajeError(err), { title: 'Error' });
    }
}

btnGuardar.addEventListener('click', async () => {
    try {
        await guardarOrdenManual();
    } catch (err) {
        console.error(err);
        const msg = String(err && (err.message || err.name || err));
        if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('insufficient')) {
            await uiAlert('No se pudo guardar: el almacenamiento del navegador esta lleno. Te conviene exportar respaldo y liberar espacio del navegador.', { title: 'Sin espacio' });
            return;
        }
        await uiAlert('No se pudo guardar la orden: ' + msg, { title: 'Error' });
    }
});

function filtrarPor(estado) {
    estadoActualFiltrado = estado;
    activarPestana(estado);
    dibujarLista();
}

tabAceptada.addEventListener('click', () => filtrarPor('Aceptada'));
tabPresupuesta.addEventListener('click', () => filtrarPor('Presupuestada'));
tabTaller.addEventListener('click', () => filtrarPor('En Reparación'));
tabTerminada.addEventListener('click', () => filtrarPor('Terminada'));
tabArchivada.addEventListener('click', () => filtrarPor('Archivada'));
menuCobrar.addEventListener('click', () => mostrarSeccion('cobrar'));
menuReparaciones.addEventListener('click', () => mostrarSeccion('reparaciones'));
menuCaja.addEventListener('click', () => mostrarSeccion('caja'));
if (cajaMesToggle) {
    cajaMesToggle.addEventListener('click', alternarSelectorMesCaja);
}
if (cajaMesToggle && cajaMesOpciones) {
    document.addEventListener('pointerdown', (event) => {
        const target = event.target;
        if (!cajaMesToggle.contains(target) && !cajaMesOpciones.contains(target)) {
            cerrarSelectorMesCaja();
        }
    });
}

function manejarEnterCamposCobrar(event) {
    if (event.key !== 'Enter') return false;
    event.preventDefault();

    if (event.target === ventaCantidad) {
        if (ventaDescripcion) ventaDescripcion.focus();
        return true;
    }

    if (event.target === ventaDescripcion) {
        if (listaArticulos) listaArticulos.classList.add('hidden');
        if (ventaImporte) ventaImporte.focus();
        return true;
    }

    if (event.target === ventaImporte) {
        if (ventaCantidad) ventaCantidad.focus();
        return true;
    }

    return false;
}

ventaDescripcion.addEventListener('focus', () => {
    actualizarSugerenciasDescripcion();
    listaArticulos.classList.remove('hidden');
});
ventaDescripcion.addEventListener('click', () => {
    actualizarSugerenciasDescripcion();
    listaArticulos.classList.remove('hidden');
});
ventaDescripcion.addEventListener('input', () => {
    actualizarSugerenciasDescripcion();
    listaArticulos.classList.remove('hidden');
});
ventaDescripcion.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        listaArticulos.classList.add('hidden');
        return;
    }
    manejarEnterCamposCobrar(event);
});

document.addEventListener('pointerdown', (event) => {
    if (!descripcionWrap || !listaArticulos) return;
    if (!descripcionWrap.contains(event.target)) {
        listaArticulos.classList.add('hidden');
    }
});

ventaCantidad.addEventListener('input', () => {
    const n = limpiarCantidadEntera(ventaCantidad.value);
    ventaCantidad.value = n ? String(n) : '';
});
ventaCantidad.addEventListener('keydown', manejarEnterCamposCobrar);

ventaImporte.addEventListener('input', () => {
    const n = limpiarImporteEntero(ventaImporte.value);
    ventaImporte.value = n ? formatearNumeroEntero(n) : '';
});
ventaImporte.addEventListener('keydown', manejarEnterCamposCobrar);

if (ventaTotalFinal) {
    ventaTotalFinal.addEventListener('input', () => {
        const n = limpiarImporteEntero(ventaTotalFinal.value);
        totalVentaManualOverride = n > 0 ? n : null;
        ventaTotalFinal.value = n ? formatearNumeroEntero(n) : '';
    });

    ventaTotalFinal.addEventListener('blur', () => {
        actualizarInputTotalFinal();
    });
}

btnAgregarItem.addEventListener('click', async () => {
    await agregarItemDesdeInputs();
});

btnRegistrarVenta.addEventListener('click', async () => {
    try {
        const posibleItem = intentarConstruirItemDesdeInputs();
        if (posibleItem) {
            itemsVentaActual.push(posibleItem);
            limpiarCamposItemVenta();
        }

        if (!itemsVentaActual.length) {
            await uiAlert('Agrega al menos un item para registrar la venta.', { title: 'Dato faltante' });
            return;
        }

        const importe = totalFinalVenta();
        const descripcion = itemsVentaActual
            .map((it) => `${it.cantidad}x ${it.descripcion}`)
            .join(' | ');

        await agregarMovimientoCaja({
            caja: 'negocio',
            descripcion,
            importe,
            origen: 'venta'
        });

        itemsVentaActual = [];
        totalVentaManualOverride = null;
        limpiarCamposItemVenta();
        dibujarTablaItemsVenta();
        listaArticulos.classList.add('hidden');
    } catch (err) {
        console.error('No se pudo registrar la venta:', err);
        const msg = String(err && (err.message || err.name || err));
        await uiAlert('No se pudo registrar la venta: ' + msg, { title: 'Error' });
    }
});

if (btnAgendaVcf) {
    btnAgendaVcf.addEventListener('click', () => descargarAgendaVcf());
}

btnExport.addEventListener('click', async () => {
    const data = await datastore.exportAll();
    if (!Array.isArray(data) || data.length === 0) {
        await uiAlert('No hay datos para exportar.', { title: 'Sin datos' });
        return;
    }

    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
    a.download = 'respaldo_reparaciones.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
});

btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    try {
        const txt = await f.text();
        const arr = JSON.parse(txt);
        await datastore.importFromArray(arr);
        await uiAlert('Tus ordenes cargaron correctamente.', { title: 'Importacion lista' });
        await fetchAndRenderSafe('refrescar ordenes');
        filtrarPor('Aceptada');
    } catch (err) {
        await uiAlert('Archivo corrupto o no valido.', { title: 'Importacion fallida' });
    }

    fileInput.value = '';
});

buscar.addEventListener('input', () => dibujarLista());
if (btnRefrescar) {
    btnRefrescar.addEventListener('click', () => fetchAndRenderSafe('refrescar ordenes'));
}

function actualizarEstadoActualizacionApp(texto, tipo = '') {
    if (!estadoActualizacionApp) return;
    estadoActualizacionApp.textContent = texto || '';
    estadoActualizacionApp.classList.remove('is-checking', 'is-ready', 'is-error');
    if (tipo) estadoActualizacionApp.classList.add(tipo);
}

function setBotonActualizacionOcupado(ocupado) {
    if (!btnActualizarApp) return;
    btnActualizarApp.disabled = ocupado;
    btnActualizarApp.textContent = ocupado ? 'Buscando...' : 'Actualizar app';
}

function activarNuevaVersionApp(worker) {
    if (!worker) return;
    actualizarEstadoActualizacionApp('Nueva version detectada. Aplicando cambios...', 'is-ready');
    worker.postMessage({ type: 'SKIP_WAITING' });
}

function observarRegistroServiceWorker(registration) {
    if (!registration) return;

    if (registration.waiting) {
        activarNuevaVersionApp(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                activarNuevaVersionApp(installing);
            }
        });
    });
}

async function buscarActualizacionApp({ silencioso = false } = {}) {
    if (!serviceWorkerRegistration) return false;

    if (!silencioso) {
        setBotonActualizacionOcupado(true);
        actualizarEstadoActualizacionApp('Buscando actualizaciones...', 'is-checking');
    }

    try {
        await serviceWorkerRegistration.update();

        if (serviceWorkerRegistration.waiting) {
            activarNuevaVersionApp(serviceWorkerRegistration.waiting);
            return true;
        }

        if (!silencioso) {
            actualizarEstadoActualizacionApp('Ya estas usando la ultima version.');
        }

        return false;
    } catch (err) {
        console.warn('No se pudo buscar actualizaciones de la app:', err);
        if (!silencioso) {
            actualizarEstadoActualizacionApp('No se pudo verificar actualizaciones. Reintenta.', 'is-error');
        }
        return false;
    } finally {
        if (!silencioso) {
            setBotonActualizacionOcupado(false);
        }
    }
}

function iniciarChequeoAutomaticoDeActualizaciones() {
    if (!serviceWorkerRegistration) return;

    if (serviceWorkerUpdateIntervalId) {
        clearInterval(serviceWorkerUpdateIntervalId);
    }

    serviceWorkerUpdateIntervalId = window.setInterval(() => {
        buscarActualizacionApp({ silencioso: true });
    }, SW_UPDATE_CHECK_INTERVAL_MS);

    window.addEventListener('focus', () => {
        buscarActualizacionApp({ silencioso: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            buscarActualizacionApp({ silencioso: true });
        }
    });
}
async function bootstrapApp() {
    actualizarIndicadorOrigenDatos();
    dibujarTablaItemsVenta();
    cargarEstadoAgendaVcf();
    mostrarSeccion('cobrar');
    const tareasInicio = [
        cargarOrdenesIniciales(),
        cargarCaja(),
        cargarCatalogoArticulos(),
        intentarPersistenciaStorage()
    ];
    await Promise.all(tareasInicio);
}

bootstrapApp().catch((err) => {
    console.error('Error al iniciar app:', err);
    uiAlert('Error al iniciar app: ' + obtenerMensajeError(err), { title: 'Error de inicio' });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        serviceWorkerHadControllerAtBoot = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!serviceWorkerHadControllerAtBoot) {
                serviceWorkerHadControllerAtBoot = true;
                return;
            }

            if (serviceWorkerReloadTriggered) return;
            serviceWorkerReloadTriggered = true;
            window.location.reload();
        });

        if (btnActualizarApp) {
            btnActualizarApp.addEventListener('click', () => {
                buscarActualizacionApp({ silencioso: false });
            });
        }

        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
            observarRegistroServiceWorker(serviceWorkerRegistration);
            iniciarChequeoAutomaticoDeActualizaciones();
            buscarActualizacionApp({ silencioso: true });
        } catch (err) {
            console.warn('No se pudo registrar el service worker:', err);
            actualizarEstadoActualizacionApp('No se pudo iniciar actualizaciones automaticas.', 'is-error');
        }
    });
}
