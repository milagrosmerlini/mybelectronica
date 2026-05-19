import datastore from './datastore.js?v=20260516-blob1';

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

let fotosTemporalesIngreso = [];
let reparaciones = [];
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

function liberarBlobUrlsRenderizados() {
    for (const url of blobUrlsRenderizados) {
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

async function migrarOrdenesSiHaceFalta(items) {
    let maxNumerico = 0;

    for (const it of items) {
        const n = extraerNumeroOrden(it);
        if (n && n > maxNumerico) maxNumerico = n;
    }

    for (const it of items) {
        const actual = extraerNumeroOrden(it);
        if (actual) {
            if (Number(it.idOrden) !== actual) {
                await datastore.updateOrder(it.id, { idOrden: actual });
            }
            continue;
        }

        maxNumerico += 1;
        await datastore.updateOrder(it.id, { idOrden: maxNumerico });
    }

    proximoNumeroOrden = maxNumerico + 1;
}

async function fetchAndRender() {
    liberarBlobUrlsRenderizados();
    const items = await datastore.getOrders();
    const normalizados = (items || []).map((it, idx) => normalizarOrden(it, idx));

    await migrarOrdenesSiHaceFalta(normalizados);

    const refreshed = await datastore.getOrders();
    reparaciones = (refreshed || []).map((it, idx) => normalizarOrden(it, idx));
    blobUrlsRenderizados = reparaciones
        .flatMap((r) => Array.isArray(r.fotos) ? r.fotos : [])
        .filter((url) => typeof url === 'string' && url.startsWith('blob:'));

    const numeros = reparaciones
        .map((it) => extraerNumeroOrden(it))
        .filter((n) => Number.isFinite(n));
    proximoNumeroOrden = (numeros.length ? Math.max(...numeros) : 0) + 1;

    dibujarLista();
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
        return (`${rep.nombre} ${rep.apellido} ${rep.telefono} ${extraerNumeroOrden(rep) || ''}`).toLowerCase().includes(q);
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

        div.innerHTML =
            `<div class="cliente"><span class="dato-resaltado">${rep.apellido}, ${rep.nombre}</span> <span class="num-orden">Orden N° ${nroOrden}</span></div>` +
            `<p><b>TELEFONO:</b> ${rep.telefono || 'No registrado'}</p>` +
            `<p><b>EQUIPO:</b> <span class="dato-resaltado">${rep.marca} ${rep.modelo}</span></p>` +
            nSerie +
            `<p><b>PROBLEMA INICIAL:</b> <span class="dato-resaltado">${rep.falla}</span></p>` +
            bloquePresupuesto +
            bloqueFotos +
            `<div class="acciones">` +
                botoneraFlujo +
                `<button class="btn-whatsapp" data-action="whatsapp">Enviar WhatsApp</button>` +
                `<button class="btn-borrar" data-action="eliminar">Eliminar</button>` +
            `</div>`;

        lista.appendChild(div);

        div.querySelectorAll('.foto-miniatura').forEach((img, idx) => {
            img.addEventListener('click', () => openPhotoViewer(rep.fotos || [], idx));
        });

        div.querySelector('[data-action="whatsapp"]').addEventListener('click', () => {
            enviarWhatsAppDirecto(rep);
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

    if (rep.estado === 'Aceptada') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Tu equipo *${rep.marca} ${rep.modelo}* ya fue ingresado correctamente bajo la orden de trabajo *N° ${numeroOrden}*. Queda a la espera de revision tecnico-diagnostica.`;
    }

    if (rep.estado === 'Presupuestada') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te adjuntamos el presupuesto para tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}*.\n\nFalla: *${rep.detallePresupuesto || rep.detalle_presupuesto || ''}*\nCosto: *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*\n\nPor favor, confirmanos si aprobas el presupuesto.`;
    }

    if (rep.estado === 'En Reparación') {
        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te informamos que el presupuesto de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}* fue aprobado y tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}* ya se encuentra en proceso de reparacion.`;
    }

    if (rep.estado === 'Terminada' || rep.estado === 'Archivada') {
        if (rep.fueReparado === false) {
            return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. Te informamos que podes pasar a retirar tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}* que quedo devuelto sin arreglo.`;
        }

        return `Hola *${rep.nombre}*, nos comunicamos desde el Servicio Tecnico *MyB Electronica*. El trabajo de tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}* ya esta listo. El costo de la reparacion es de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*. Podes pasar a retirarlo cuando gustes.`;
    }

    return `Hola *${rep.nombre}*, tenemos novedades sobre tu orden *N° ${numeroOrden}*.`;
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
    await fetchAndRender();
}

async function entregarEquipoFijo(rep) {
    const ok = confirm('¿Confirmas que el cliente pago y retiro el equipo? Irá a la pestaña de Archivadas.');
    if (!ok) return;

    await datastore.updateOrder(rep.id, { estado: 'Archivada' });

    if (rep.telefono) {
        const numLimpio = limpiarNumeroTelefonoFijo(rep.telefono);
        const numeroOrden = extraerNumeroOrden(rep) || rep.idOrden || rep.id;
        const textoCierre = rep.fueReparado === false
            ? `Hola *${rep.nombre}*, te confirmamos que tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}* fue retirado de nuestro local (Devuelto sin arreglo). Muchas gracias por confiar en *MyB Electronica*!`
            : `Hola *${rep.nombre}*, te confirmamos que tu equipo *${rep.marca} ${rep.modelo}* bajo la orden de trabajo *N° ${numeroOrden}* fue entregado y cobrado correctamente la suma de *$${rep.precioPresupuesto || rep.precio_presupuesto || ''}*. Muchas gracias por confiar en *MyB Electronica*!`;

        const urlCierre = `whatsapp://send?phone=${numLimpio}&text=${encodeURIComponent(textoCierre)}`;
        window.location.href = urlCierre;
    }

    estadoActualFiltrado = 'Terminada';
    activarPestana('Terminada');
    await fetchAndRender();
}

async function abrirCargaPresupuesto(rep) {
    const detalle = prompt('¿Cual es la falla real que encontraste en el diagnostico tecnico?', rep.detallePresupuesto || rep.detalle_presupuesto || '');
    if (detalle === null) return;

    const precioInput = prompt('¿Cual es el costo/precio final de esta reparacion? (No importa si no pones los puntos)', rep.precioPresupuesto || rep.precio_presupuesto || '');
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

    await fetchAndRender();
}

async function rechazarPresupuestoFijo(rep) {
    const ok = confirm('¿Marcar este equipo como rechazado por el cliente? Se enviará a terminadas sin costo y disparará el aviso.');
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

    await fetchAndRender();
}

async function guardarOrdenManual() {
    const nom = document.getElementById('nombre').value.trim();
    const ape = document.getElementById('apellido').value.trim();
    const tel = document.getElementById('telefono').value.trim();
    const mar = document.getElementById('marca').value.trim();
    const mod = document.getElementById('modelo').value.trim();
    const ser = document.getElementById('serie').value.trim();
    const fal = document.getElementById('falla').value.trim();

    if (!nom || !ape || !mar || !mod || !fal) {
        alert('Por favor, completa los campos obligatorios para ingresar el equipo.');
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

    proximoNumeroOrden += 1;

    document.getElementById('nombre').value = '';
    document.getElementById('apellido').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('marca').value = '';
    document.getElementById('modelo').value = '';
    document.getElementById('serie').value = '';
    document.getElementById('falla').value = '';

    limpiarFotosTemporalesIngreso();
    mostrarVistaPreviaIngreso();

    estadoActualFiltrado = 'Aceptada';
    activarPestana('Aceptada');

    enviarWhatsAppDirecto(nuevaOrden);
    await fetchAndRender();
}

async function eliminarOrden(id) {
    const ok = confirm('¿Estas seguro de borrar este registro de forma permanente?');
    if (!ok) return;
    await datastore.deleteOrder(id);
    await fetchAndRender();
}

btnGuardar.addEventListener('click', async () => {
    try {
        await guardarOrdenManual();
    } catch (err) {
        console.error(err);
        const msg = String(err && (err.message || err.name || err));
        if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('insufficient')) {
            alert('No se pudo guardar: el almacenamiento del navegador esta lleno. Te conviene exportar respaldo y liberar espacio del navegador.');
            return;
        }
        alert('No se pudo guardar la orden: ' + msg);
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

btnExport.addEventListener('click', async () => {
    const data = await datastore.exportAll();
    if (!Array.isArray(data) || data.length === 0) {
        alert('No hay datos para exportar.');
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
        alert('Tus ordenes cargaron correctamente.');
        await fetchAndRender();
        filtrarPor('Aceptada');
    } catch (err) {
        alert('Archivo corrupto o no valido.');
    }

    fileInput.value = '';
});

buscar.addEventListener('input', () => dibujarLista());
btnRefrescar.addEventListener('click', () => fetchAndRender());

intentarPersistenciaStorage();
fetchAndRender();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (err) {
            console.warn('No se pudo registrar el service worker:', err);
        }
    });
}

