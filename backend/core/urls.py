"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.urls import include, path
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from core.views import health_check, readiness_check

@csrf_exempt
def home(request):
    message = ""
    success = False
    username = ""

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        if username == "admin" and password == "1234":
            message = f"Hola {escape(username)}! Login exitoso."
            success = True
        else:
            message = "Credenciales invalidas. Prueba con admin / 1234."

    status_block = ""
    if message:
        css_class = "success" if success else "error"
        status_block = f'<p class="message {css_class}">{message}</p>'

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Mi PyME - Login</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }}
        .card {{
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            width: 320px;
        }}
        h1 {{
            font-size: 1.5rem;
            margin-top: 0;
            margin-bottom: 12px;
        }}
        p.subtitle {{
            margin-top: 0;
            color: #555;
        }}
        label {{
            display: block;
            font-weight: bold;
            margin-bottom: 4px;
            margin-top: 12px;
        }}
        input {{
            width: 100%;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ccc;
            box-sizing: border-box;
        }}
        button {{
            margin-top: 16px;
            width: 100%;
            padding: 10px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }}
        button:hover {{
            background: #1d4ed8;
        }}
        .message {{
            margin-top: 12px;
            padding: 8px;
            border-radius: 4px;
        }}
        .message.success {{
            background: #dcfce7;
            color: #166534;
        }}
        .message.error {{
            background: #fee2e2;
            color: #b91c1c;
        }}
        .hint {{
            margin-top: 12px;
            font-size: 0.85rem;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="card">
        <h1>Bienvenido a mi PyME</h1>
        <p class="subtitle">Ingresa para continuar</p>
        {status_block}
        <form method="post">
            <label for="username">Usuario</label>
            <input type="text" id="username" name="username" value="{escape(username)}" autocomplete="username">
            <label for="password">Contrasena</label>
            <input type="password" id="password" name="password" autocomplete="current-password">
            <button type="submit">Ingresar</button>
        </form>
        <p class="hint">Demo: usuario <strong>admin</strong>, contrasena <strong>1234</strong>.</p>
    </div>
</body>
</html>"""
    return HttpResponse(html)


def demo_dashboard(request):
    csrf_token = get_token(request)
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Demo PyME</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f5f6f8; }}
        header {{ margin-bottom: 24px; }}
        h1 {{ margin: 0 0 8px; }}
        .grid {{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }}
        section {{ background: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.08); }}
        button {{ padding: 6px 12px; margin-top: 8px; cursor: pointer; }}
        label {{ display: block; margin-top: 8px; font-weight: bold; }}
        input, textarea {{ width: 100%; padding: 6px; margin-top: 4px; box-sizing: border-box; }}
        pre {{ background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; height: 180px; overflow: auto; }}
        small {{ color: #475569; display: block; margin-top: 4px; }}
    </style>
</head>
<body>
    <header>
        <h1>Demo rapido Mi PyME</h1>
        <p>Botones para consultar la API y formularios sencillos para crear datos.</p>
    </header>
    <div class="grid">
        <section>
            <h2>Consultas</h2>
            <button onclick="fetchData('clientes', 'clientesOut')">Clientes</button>
            <button onclick="fetchData('proveedores', 'proveedoresOut')">Proveedores</button>
            <button onclick="fetchData('productos', 'productosOut')">Productos</button>
            <button onclick="fetchData('compras', 'comprasOut')">Compras</button>
            <button onclick="fetchData('finanzas/movimientos', 'finanzasOut')">Movimientos</button>
            <button onclick="fetchData('ventas', 'ventasOut')">Ventas</button>
            <h3>Clientes</h3>
            <pre id="clientesOut">Pulsa el boton para cargar.</pre>
            <h3>Proveedores</h3>
            <pre id="proveedoresOut"></pre>
            <h3>Productos</h3>
            <pre id="productosOut"></pre>
            <h3>Ventas</h3>
            <pre id="ventasOut"></pre>
        </section>
        <section>
            <h2>Nuevo proveedor</h2>
            <label>Nombre<input id="provNombre" placeholder="Ej: Insumos SRL"></label>
            <label>Identificacion<input id="provIdent" placeholder="CUIT"></label>
            <label>Correo<input id="provCorreo" type="email"></label>
            <button onclick="crearProveedor()">Crear</button>
            <pre id="proveedorResp"></pre>
            <h2 style="margin-top:24px">Nuevo producto</h2>
            <label>Nombre<input id="prodNombre" placeholder="Ej: Bulto papel"></label>
            <label>SKU<input id="prodSku" placeholder="Opcional"></label>
            <label>Precio<input id="prodPrecio" type="number" step="0.01" value="0"></label>
            <label>Stock<input id="prodStock" type="number" value="0"></label>
            <button onclick="crearProducto()">Crear</button>
            <pre id="productoResp"></pre>
        </section>
        <section>
            <h2>Nueva compra</h2>
            <label>Proveedor ID<input id="compProveedor" type="number"></label>
            <label>Categoria ID<input id="compCategoria" type="number" placeholder="Opcional"></label>
            <label>Numero<input id="compNumero" placeholder="Factura"></label>
            <label>Notas<textarea id="compNotas" rows="2"></textarea></label>
            <label>Lineas (JSON)
            <textarea id="compLineas" rows="6" placeholder='[
    {{"producto": 1, "descripcion": "Materia prima", "cantidad": 10, "precio_unitario": 125.5}},
    {{"descripcion": "Insumo B", "kilaje": 5.5, "total_linea": 2750}}
]'></textarea>
            <small>Puedes enviar "producto" (opcional) y definir por linea cantidad o kilaje, mas precio_unitario o total_linea.</small>
            </label>
            <button onclick="crearCompra()">Registrar compra</button>
            <pre id="compraResp"></pre>
            <h3>Resumenes</h3>
            <button onclick="fetchData('compras/resumen/proveedores', 'resumenProv')">Por proveedor</button>
            <button onclick="fetchData('compras/resumen/categorias', 'resumenCat')">Por categoria</button>
            <pre id="resumenProv"></pre>
            <pre id="resumenCat"></pre>
        </section>
        <section>
            <h2>Ventas</h2>
            <h3>Agregar venta</h3>
            <label>Cliente ID<input id="ventaCliente" type="number"></label>
            <label>Descripcion<textarea id="ventaDescripcion" rows="2"></textarea></label>
            <label>Cantidad<input id="ventaCantidad" type="number" step="0.01" value="1"></label>
            <label>Precio<input id="ventaPrecio" type="number" step="0.01" value="0"></label>
            <label>Numero<input id="ventaNumero" placeholder="Opcional"></label>
            <button onclick="crearVenta()">Registrar venta</button>
            <pre id="ventaResp"></pre>
            <h3>Registrar pago</h3>
            <label>Cliente ID<input id="pagoCliente" type="number"></label>
            <label>Monto<input id="pagoMonto" type="number" step="0.01" value="0"></label>
            <label>Medio
                <select id="pagoMedio">
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="CHEQUE">Cheque</option>
                </select>
            </label>
            <label>Observacion<textarea id="pagoObservacion" rows="2"></textarea></label>
            <button onclick="registrarPago()">Registrar pago</button>
            <pre id="pagoResp"></pre>
        </section>
        <section>
            <h2>Finanzas</h2>
            <button onclick="fetchData('finanzas/pagos', 'finPagos')">Pagos clientes</button>
            <button onclick="fetchData('finanzas/movimientos/ingresos', 'finIngresos')">Ingresos</button>
            <button onclick="fetchData('finanzas/movimientos/gastos', 'finGastos')">Gastos</button>
            <button onclick="fetchData('finanzas/movimientos/resumen/pendiente', 'finResumen')">Resumen pendiente</button>
            <pre id="finPagos"></pre>
            <h3>Ingresos</h3>
            <pre id="finIngresos"></pre>
            <h3>Gastos</h3>
            <pre id="finGastos"></pre>
            <h3>Resumen pendiente de cobro</h3>
            <pre id="finResumen"></pre>
            <h3>Movimientos</h3>
            <pre id="finanzasOut"></pre>
            <h3>Registrar gasto manual</h3>
            <label>Monto<input id="gastoMonto" type="number" step="0.01" value="0"></label>
            <label>Descripción<textarea id="gastoDescripcion" rows="2"></textarea></label>
            <label>Origen
                <select id="gastoOrigen">
                    <option value="MANUAL">Manual</option>
                    <option value="COMPRA">Compra</option>
                    <option value="PAGO_EMPLEADO">Pago empleado</option>
                </select>
            </label>
            <button onclick="registrarGasto()">Registrar gasto</button>
            <pre id="gastoResp"></pre>
        </section>
    </div>
    <script>
        const CSRF_TOKEN = "{csrf_token}";
        function show(target, data) {{
            const el = document.getElementById(target);
            if (!el) return;
            el.textContent = JSON.stringify(data, null, 2);
        }}
        async function fetchData(endpoint, target) {{
            try {{
                const res = await fetch(`/api/${{endpoint}}/`);
                if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
                const data = await res.json();
                show(target, data);
            }} catch (err) {{
                show(target, {{ error: err.message }});
            }}
        }}
        async function crearProveedor() {{
            const payload = {{
                nombre: document.getElementById('provNombre').value,
                identificacion: document.getElementById('provIdent').value,
                correo: document.getElementById('provCorreo').value
            }};
            const data = await postJson('/api/proveedores/', payload);
            show('proveedorResp', data);
        }}
        async function crearProducto() {{
            const payload = {{
                nombre: document.getElementById('prodNombre').value,
                sku: document.getElementById('prodSku').value,
                precio: document.getElementById('prodPrecio').value || 0,
                stock: document.getElementById('prodStock').value || 0
            }};
            const data = await postJson('/api/productos/', payload);
            show('productoResp', data);
        }}
        async function crearVenta() {{
            const payload = {{
                cliente: document.getElementById('ventaCliente').value,
                descripcion: document.getElementById('ventaDescripcion').value,
                cantidad: document.getElementById('ventaCantidad').value || 0,
                precio_unitario: document.getElementById('ventaPrecio').value || 0,
                numero: document.getElementById('ventaNumero').value,
            }};
            const data = await postJson('/api/ventas/agregar-simple/', payload);
            show('ventaResp', data);
        }}

        async function registrarPago() {{
            const payload = {{
                cliente: document.getElementById('pagoCliente').value,
                monto: document.getElementById('pagoMonto').value || 0,
                medio: document.getElementById('pagoMedio').value,
                observacion: document.getElementById('pagoObservacion').value,
            }};
            const data = await postJson('/api/ventas/registrar-pago/', payload);
            show('pagoResp', data);
        }}

        async function registrarGasto() {{
            const payload = {{
                monto: document.getElementById('gastoMonto').value || 0,
                descripcion: document.getElementById('gastoDescripcion').value,
                origen: document.getElementById('gastoOrigen').value,
            }};
            const data = await postJson('/api/finanzas/movimientos/registrar-gasto/', payload);
            show('gastoResp', data);
        }}

        async function crearCompra() {{
            let lineas = [];
            try {{
                const raw = document.getElementById('compLineas').value || '[]';
                lineas = JSON.parse(raw);
            }} catch (err) {{
                show('compraResp', {{ error: 'JSON invalido en lineas' }});
                return;
            }}
            const payload = {{
                proveedor: document.getElementById('compProveedor').value,
                categoria: document.getElementById('compCategoria').value || null,
                numero: document.getElementById('compNumero').value,
                notas: document.getElementById('compNotas').value,
                lineas
            }};
            const data = await postJson('/api/compras/', payload);
            show('compraResp', data);
        }}
        async function postJson(url, payload) {{
            try {{
                const res = await fetch(url, {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN
                    }},
                    body: JSON.stringify(payload)
                }});
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || res.statusText);
                return data;
            }} catch (err) {{
                return {{ error: err.message }};
            }}
        }}
    </script>
</body>
</html>"""
    return HttpResponse(html)


urlpatterns = [
    path("", home),
    path("demo/", demo_dashboard),
    path("api/health/", health_check, name="health"),
    path("api/ready/", readiness_check, name="readiness"),
    path('admin/', admin.site.urls),
    path("api/usuarios/", include("usuarios.urls")),
    path("api/configuracion/", include("configuracion.urls")),
    path("api/clientes/", include("clientes.urls")),
    path("api/proveedores/", include("proveedores.urls")),
    path("api/rrhh/", include("recursos_humanos.urls")),
    path("api/compras/", include("compras.urls")),
    path("api/ventas/", include("ventas.urls")),
    path("api/productos/", include("productos.urls")),
    path("api/finanzas/", include("finanzas_reportes.urls")),
    path("api/inventario/", include("inventario.urls")),
    path("api/contabilidad/", include("contabilidad.urls")),
]
