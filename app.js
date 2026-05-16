// Esta app funciona localmente con IndexedDB a través de datastore.js.
// El código hoy guarda órdenes y fotos en el navegador sin conexión.
// En el futuro, podés reemplazar datastore.js por un adapter remoto (Supabase/U otra DB).
import datastore from './datastore.js';

const lista = document.getElementById('listaReparaciones');
const fotoInput = document.getElementById('fotoInput');
const vistaPreviaIngreso = document.getElementById('vistaPreviaIngreso');
const btnGuardar = document.getElementById('btn-guardar');
const fileInput = document.getElementById('fileInput');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const btnTomarFotos = document.getElementById('btn-tomar-fotos');
const buscar = document.getElementById('buscar');
const filtroEstado = document.getElementById('filtroEstado');
const btnRefrescar = document.getElementById('btn-refrescar');
const photoViewer = document.getElementById('photoViewer');
const viewerClose = document.getElementById('viewerClose');
const viewerPrev = document.getElementById('viewerPrev');
const viewerNext = document.getElementById('viewerNext');
const viewerImage = document.getElementById('viewerImage');
const viewerIndex = document.getElementById('viewerIndex');
const viewerTotal = document.getElementById('viewerTotal');

let fotosTemporalesIngreso = [];
let viewerPhotos = [];
let viewerCurrent = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;

btnTomarFotos.addEventListener('click', ()=> fotoInput.click());
fotoInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    for(const f of files){
        const b64 = await fileToDataUrl(f);
        fotosTemporalesIngreso.push({ name: f.name, file: f, dataUrl: b64 });
    }
    mostrarVistaPreviaIngreso();
});

function mostrarVistaPreviaIngreso(){
    if(fotosTemporalesIngreso.length===0){ vistaPreviaIngreso.style.display='none'; return; }
    vistaPreviaIngreso.style.display='flex';
    const urls = fotosTemporalesIngreso.map(f=>f.dataUrl);
    vistaPreviaIngreso.innerHTML = urls.map((url,i)=>`<div class="foto-contenedor"><img src="${url}" class="foto-miniatura" data-idx="${i}"></div>`).join('');
    vistaPreviaIngreso.querySelectorAll('.foto-miniatura').forEach((img, idx)=> img.addEventListener('click', ()=> openPhotoViewer(urls, idx)));
}

function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

btnGuardar.addEventListener('click', async ()=>{
    const nom = document.getElementById('nombre').value.trim();
    const ape = document.getElementById('apellido').value.trim();
    const tel = document.getElementById('telefono').value.trim();
    const mar = document.getElementById('marca').value.trim();
    const mod = document.getElementById('modelo').value.trim();
    const ser = document.getElementById('serie').value.trim();
    const fal = document.getElementById('falla').value.trim();
    if(!nom||!ape||!mar||!mod||!fal){ alert('Completa los campos obligatorios'); return; }

    const idOrden = 'ord_' + Date.now();
    const created_at = new Date().toISOString();
    const order = {
        id: idOrden,
        idOrden: idOrden,
        nombre: nom.toUpperCase(),
        apellido: ape.toUpperCase(),
        telefono: tel,
        marca: mar.toUpperCase(),
        modelo: mod.toUpperCase(),
        serie: ser.toUpperCase(),
        falla: fal.toUpperCase(),
        estado: 'Aceptada',
        detalle_presupuesto: '',
        precio_presupuesto: '',
        fue_reparado: true,
        fotos: [],
        created_at
    };

    try{
        const files = fotosTemporalesIngreso.map(f=>f.file);
        await datastore.addOrder(order, files);
        // limpiar UI
        document.getElementById('nombre').value=''; document.getElementById('apellido').value=''; document.getElementById('telefono').value='';
        document.getElementById('marca').value=''; document.getElementById('modelo').value=''; document.getElementById('serie').value=''; document.getElementById('falla').value='';
        fotosTemporalesIngreso = []; mostrarVistaPreviaIngreso();
        fetchAndRender();
        enviarWhatsAppDirecto({ nombre: order.nombre, apellido: order.apellido, telefono: order.telefono, marca: order.marca, modelo: order.modelo, idOrden: order.idOrden, estado: order.estado });
    }catch(err){ console.error(err); alert('Error al crear orden localmente: '+err.message); }
});

async function fetchAndRender(){
    const items = await datastore.getOrders();
    renderLista(items || []);
}

function renderLista(items){
    lista.innerHTML = '';
    const q = (buscar.value||'').trim().toLowerCase();
    const estadoFilter = filtroEstado.value;
    const filtrados = (items||[]).filter(it=>{
        if(estadoFilter && it.estado !== estadoFilter) return false;
        if(!q) return true;
        return ((it.nombre||'') + ' ' + (it.apellido||'') + ' ' + (it.telefono||'') + ' ' + (it.idOrden||'')).toLowerCase().includes(q);
    });
    if(filtrados.length===0){ lista.innerHTML = '<p style="text-align:center; color:#7f8c8d; background: white; padding: 20px; border-radius: 8px;">No hay órdenes.</p>'; return; }
    for(const rep of filtrados){
        const div = document.createElement('div');
        const clase = 'borde-' + (rep.estado || 'Aceptada').replace(/ /g,'');
        div.className = 'registro ' + clase;
        const fotosHtml = rep.fotos && rep.fotos.length ? '<div class="galeria-fotos">'+ rep.fotos.map(u=>`<div class="foto-contenedor"><img src="${u}" class="foto-miniatura" data-url="${u}"></div>`).join('') +'</div>' : '';
        div.innerHTML = `<div class="cliente">👤 <span class="dato-resaltado">${rep.apellido}, ${rep.nombre}</span> <span class="num-orden">${rep.idOrden}</span></div>`+
                        `<p><b>📞 TELÉFONO:</b> ${rep.telefono||'No registrado'}</p>`+
                        `<p><b>⚙️ EQUIPO:</b> <span class="dato-resaltado">${rep.marca} ${rep.modelo}</span></p>`+
                        `<p><b>🚨 PROBLEMA INICIAL:</b> <span class="dato-resaltado">${rep.falla}</span></p>` +
                        fotosHtml +
                        `<div class="acciones">`+
                            `<button class="btn-flujo" data-id="${rep.id}" data-action="presupuestar">📋 Presupuestar</button>`+
                            `<button class="btn-whatsapp">💬 Enviar WhatsApp</button>`+
                            `<button class="btn-borrar">🗑️ Eliminar</button>`+
                        `</div>`;
        lista.appendChild(div);
        // attach events
        div.querySelectorAll('.foto-miniatura').forEach((img, idx)=> img.addEventListener('click', ()=> openPhotoViewer(rep.fotos || [], idx)));
        div.querySelector('.btn-whatsapp').addEventListener('click', ()=> enviarWhatsAppDirecto(rep));
        div.querySelector('.btn-borrar').addEventListener('click', ()=> eliminarOrden(rep.id));
        div.querySelectorAll('.btn-flujo').forEach(b=> b.addEventListener('click', ()=> abrirPresupuesto(rep)));
    }
}

function openPhotoViewer(photos, index){
    if(!Array.isArray(photos) || photos.length === 0) return;
    viewerPhotos = photos;
    viewerCurrent = Math.max(0, Math.min(index, photos.length - 1));
    viewerImage.src = viewerPhotos[viewerCurrent];
    viewerIndex.textContent = viewerCurrent + 1;
    viewerTotal.textContent = viewerPhotos.length;
    photoViewer.classList.remove('hidden');
}

function updateViewer(){
    if(!viewerPhotos.length) return;
    viewerImage.src = viewerPhotos[viewerCurrent];
    viewerIndex.textContent = viewerCurrent + 1;
    viewerTotal.textContent = viewerPhotos.length;
}

viewerClose.addEventListener('click', ()=> photoViewer.classList.add('hidden'));
viewerPrev.addEventListener('click', ()=>{
    if(viewerCurrent > 0) { viewerCurrent--; updateViewer(); }
});
viewerNext.addEventListener('click', ()=>{
    if(viewerCurrent < viewerPhotos.length - 1) { viewerCurrent++; updateViewer(); }
});
photoViewer.addEventListener('click', (event)=>{
    if(event.target === photoViewer) photoViewer.classList.add('hidden');
});

viewerImage.addEventListener('touchstart', (event)=>{
    if(event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});
viewerImage.addEventListener('touchend', (event)=>{
    touchEndX = event.changedTouches[0].clientX;
    touchEndY = event.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold){
        if(dx < 0 && viewerCurrent < viewerPhotos.length - 1){ viewerCurrent++; updateViewer(); }
        else if(dx > 0 && viewerCurrent > 0){ viewerCurrent--; updateViewer(); }
    }
});

document.addEventListener('keydown', (event)=>{
    if(photoViewer.classList.contains('hidden')) return;
    if(event.key === 'Escape') photoViewer.classList.add('hidden');
    if(event.key === 'ArrowLeft') viewerPrev.click();
    if(event.key === 'ArrowRight') viewerNext.click();
});

async function abrirPresupuesto(rep){
    const detalle = prompt('Detalle de falla/dx', rep.detalle_presupuesto||'') ; if(detalle===null) return;
    const precio = prompt('Precio de reparación (sin puntos)', rep.precio_presupuesto||''); if(precio===null) return;
    const upd = {
        detalle_presupuesto: detalle.trim().toUpperCase(),
        precio_presupuesto: precio.trim(),
        fue_reparado: true,
        estado: 'Presupuestada'
    };
    await datastore.updateOrder(rep.id, upd);
    fetchAndRender();
    enviarWhatsAppDirecto({ nombre: rep.nombre, apellido: rep.apellido, telefono: rep.telefono, marca: rep.marca, modelo: rep.modelo, idOrden: rep.idOrden, estado: 'Presupuestada', detalle_presupuesto: upd.detalle_presupuesto, precio_presupuesto: upd.precio_presupuesto });
}

async function eliminarOrden(id){ if(!confirm('Eliminar registro?')) return; await datastore.deleteOrder(id); fetchAndRender(); }

function enviarWhatsAppDirecto(rep){ if(!rep.telefono){ alert('No hay teléfono registrado'); return; } const num = limpiarNumeroTelefonoFijo(rep.telefono); let texto = '';
    if(rep.estado === 'Aceptada') texto = `Hola *${rep.nombre}*, tu equipo *${rep.marca} ${rep.modelo}* fue ingresado bajo la orden *${rep.idOrden}*.`;
    else if(rep.estado === 'Presupuestada') texto = `Hola *${rep.nombre}*, presupuestamos tu equipo *${rep.marca} ${rep.modelo}* (Orden ${rep.idOrden}).\n🛠️ Falla: *${rep.detalle_presupuesto || ''}*\n💵 Costo: *$${rep.precio_presupuesto || ''}*`;
    else texto = `Hola *${rep.nombre}*, actualizamos el estado de tu orden *${rep.idOrden}*: ${rep.estado}`;
    const urlNative = `whatsapp://send?phone=${num}&text=${encodeURIComponent(texto)}`;
    const urlWeb = `https://web.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(texto)}`;
    // intentar abrir nativo; si no responde, abrir web
    const opened = window.open(urlNative, '_self');
    setTimeout(()=>{ window.open(urlWeb, '_blank'); }, 800);
}

function limpiarNumeroTelefonoFijo(telRaw){ const num = (telRaw||'').replace(/\D/g,''); if(!num) return ''; if(num.indexOf('54')===0) return num; return '54'+num; }

// Export / Import JSON usando IndexedDB
btnExport.addEventListener('click', async ()=>{
    const data = await datastore.exportAll();
    const a = document.createElement('a'); a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data)); a.download='respaldo_reparaciones.json'; document.body.appendChild(a); a.click(); a.remove();
});

btnImport.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return; const txt = await f.text(); try{ const arr = JSON.parse(txt); await datastore.importFromArray(arr); alert('Importado'); fetchAndRender(); }catch(err){ alert('Archivo inválido'); }
});

// Buscador, filtro y refrescar
buscar.addEventListener('input', ()=> fetchAndRender()); filtroEstado.addEventListener('change', ()=> fetchAndRender()); btnRefrescar.addEventListener('click', ()=> fetchAndRender());

// Inicia
fetchAndRender();

