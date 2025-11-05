import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComprasPage from "@/pages/compras/ComprasPage";
import type {
  Compra,
  Producto,
  Proveedor,
  ResumenCompraPorCategoria,
  ResumenCompraPorProveedor
} from "@/types/mipyme";

const mockUseListado = vi.fn();
const mockRequest = vi.fn();

vi.mock("@/hooks/useListado", () => ({
  useListado: (endpoint: string) => mockUseListado(endpoint)
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

describe("ComprasPage", () => {
  const recargarCompras = vi.fn();

  beforeEach(() => {
    recargarCompras.mockReset();
    recargarCompras.mockResolvedValue(undefined);
    mockRequest.mockReset();

    mockUseListado.mockImplementation((endpoint: string) => {
      if (endpoint === "/compras/") {
        return {
          datos: [
            {
              id: 1,
              fecha: "2025-09-21",
              numero: "C-1",
              proveedor: 5,
              proveedor_nombre: "Proveedor Demo",
              categoria: null,
              categoria_nombre: null,
              total: "100.00",
              notas: "Compra demo",
              lineas: []
            } satisfies Compra
          ],
          cargando: false,
          error: null,
          recargar: recargarCompras
        };
      }
      if (endpoint === "/productos/") {
        return {
          datos: [
            {
              id: 10,
              nombre: "Insumo A",
              sku: "INS-A",
              descripcion: "",
              precio: "15.00",
              stock: "50",
              activo: true
            },
            {
              id: 11,
              nombre: "Materia B",
              sku: "MAT-B",
              descripcion: "",
              precio: "30.00",
              stock: "10",
              activo: true
            }
          ] as Producto[],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }
      if (endpoint === "/compras/materias-primas/") {
        return {
          datos: [
            {
              id: 100,
              nombre: "Materia Prima A",
              sku: "MP-A",
              descripcion: "",
              precio: "0",
              stock: "120",
              activo: true
            } as Producto
          ],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }
      if (endpoint === "/proveedores/") {
        return {
          datos: [
            {
              id: 5,
              nombre: "Proveedor Demo",
              identificacion: "20999999999",
              contacto: "",
              telefono: "",
              correo: "",
              direccion: "",
              notas: "",
              activo: true
            }
          ] as Proveedor[],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }
      throw new Error(`Endpoint no mockeado: ${endpoint}`);
    });

    mockRequest.mockImplementation((options: { url: string; method?: string }) => {
      if (options.method === "POST") {
        return Promise.resolve({} as Compra);
      }

      const url = new URL(options.url, "http://localhost");

      if (url.pathname === "/compras/resumen/proveedores/") {
        const periodo = url.searchParams.get("periodo") ?? "anual";
        return Promise.resolve<ResumenCompraPorProveedor[]>([
          { proveedor_id: 5, proveedor: "Proveedor Demo", total: periodo === "mensual" ? 80 : 100, compras: 1 }
        ]);
      }

      if (url.pathname === "/compras/resumen/categorias/") {
        const periodo = url.searchParams.get("periodo") ?? "anual";
        return Promise.resolve<ResumenCompraPorCategoria[]>([
          { categoria_id: null, categoria: "Sin categoria", total: periodo === "mensual" ? 80 : 100, compras: 1 }
        ]);
      }

      throw new Error(`URL no mockeada: ${options.url}`);
    });
  });

  it("muestra resumenes y panel de stock", async () => {
    render(<ComprasPage />);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/compras/resumen/proveedores/?periodo=anual" })
      );
    });

    expect(screen.getByText(/Resumen por proveedor/)).toBeInTheDocument();
    expect(screen.getByText(/Resumen por categoria/)).toBeInTheDocument();
    expect(screen.getByText("Materia Prima A")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Stock de materia prima/i })).toBeInTheDocument();
  });

  it("actualiza los resumenes al cambiar el periodo", async () => {
    render(<ComprasPage />);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/compras/resumen/proveedores/?periodo=anual" })
      );
    });

    mockRequest.mockClear();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Periodo/i), "mensual");

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/compras/resumen/proveedores/?periodo=mensual" })
      );
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/compras/resumen/categorias/?periodo=mensual" })
      );
    });
  });

  it("permite recargar datos", async () => {
    render(<ComprasPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Recargar datos/i }));

    await waitFor(() => {
      expect(recargarCompras).toHaveBeenCalled();
    });
  });

  it("registra una compra rapida con producto y refresca los datos", async () => {
    render(<ComprasPage />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Proveedor/i), "5");
    await user.selectOptions(screen.getByLabelText(/Materia prima/i), "100");
    await user.clear(screen.getByLabelText(/Descripcion/));
    await user.type(screen.getByLabelText(/Descripcion/), "Compra insumo con IVA");
    await user.clear(screen.getByLabelText(/Cantidad/i));
    await user.type(screen.getByLabelText(/Cantidad/i), "1");
    await user.type(screen.getByLabelText(/Precio unitario/i), "250");
    await user.click(screen.getByLabelText(/Aplicar IVA 21%/i));
    await user.type(screen.getByLabelText(/Numero de factura/i), "FC-123");

    await user.click(screen.getByRole("button", { name: /Registrar compra/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/compras/",
          data: expect.objectContaining({
            proveedor: 5,
            numero: "FC-123",
            lineas: [
              expect.objectContaining({
                materia_prima: 100,
                descripcion: "Compra insumo con IVA",
                cantidad: 1,
                precio_unitario: 250,
                total_linea: 302.5
              })
            ]
          })
        })
      );
    });

    await waitFor(() => {
      expect(recargarCompras).toHaveBeenCalled();
    });

    expect(await screen.findByText("Compra registrada correctamente")).toBeInTheDocument();
  });

  it("registra una compra sin producto asociado", async () => {
    render(<ComprasPage />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Proveedor/i), "5");
    await user.type(screen.getByLabelText(/Descripcion/), "Pago de servicios");
    await user.clear(screen.getByLabelText(/Cantidad/i));
    await user.type(screen.getByLabelText(/Cantidad/i), "1");
    await user.type(screen.getByLabelText(/Precio unitario/i), "100");

    await user.click(screen.getByRole("button", { name: /Registrar compra/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/compras/",
          data: expect.objectContaining({
            proveedor: 5,
            numero: undefined,
            lineas: [
              expect.objectContaining({
                materia_prima: null,
                descripcion: "Pago de servicios",
                cantidad: 1,
                precio_unitario: 100,
                total_linea: 100
              })
            ]
          })
        })
      );
    });

    await waitFor(() => {
      expect(recargarCompras).toHaveBeenCalled();
    });

    expect(await screen.findByText("Compra registrada correctamente")).toBeInTheDocument();
  });
});

