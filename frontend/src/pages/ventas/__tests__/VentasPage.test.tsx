import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VentasPage from "@/pages/ventas/VentasPage";
import type { Cliente, Producto, Venta } from "@/types/mipyme";

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

describe("VentasPage", () => {
  const recargarVentas = vi.fn();

  beforeEach(() => {
    mockRequest.mockReset();
    recargarVentas.mockReset();
    recargarVentas.mockResolvedValue(undefined);

    mockUseListado.mockImplementation((endpoint: string) => {
      if (endpoint === "/ventas/") {
        return {
          datos: [
            {
              id: 10,
              fecha: "2025-09-20",
              numero: "V-10",
              cliente: 1,
              cliente_nombre: "Cliente Demo",
              total: "1500.00",
              lineas: [
                {
                  id: 1,
                  producto: 5,
                  producto_nombre: "Producto X",
                  descripcion: "Producto X",
                  cantidad: "1",
                  precio_unitario: "1500.00",
                  subtotal: "1500.00"
                }
              ]
            } satisfies Venta,
            {
              id: 11,
              fecha: "2025-09-26",
              numero: "FA-0112",
              cliente: 2,
              cliente_nombre: "Rodrigo",
              total: "130000.00",
              lineas: [
                {
                  id: 2,
                  producto: null,
                  producto_nombre: null,
                  descripcion: "Muzzarella x10",
                  cantidad: "20",
                  precio_unitario: "6500.00",
                  subtotal: "130000.00"
                }
              ]
            } satisfies Venta
          ],
          cargando: false,
          error: null,
          recargar: recargarVentas
        };
      }
      if (endpoint === "/clientes/") {
        return {
          datos: [
            {
              id: 1,
              nombre: "Cliente Demo",
              identificacion: "20123456789",
              direccion: "Av. Siempre Viva",
              telefono: "1112345678",
              correo: "demo@mipyme.com",
              saldo: "0"
            } satisfies Cliente,
            {
              id: 2,
              nombre: "Rodrigo",
              identificacion: "20999888777",
              direccion: "Calle Falsa 123",
              telefono: "1098765432",
              correo: "rodrigo@mipyme.com",
              saldo: "0"
            } satisfies Cliente
          ],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }
      if (endpoint === "/productos/") {
        return {
          datos: [
            {
              id: 5,
              nombre: "Producto X",
              sku: "PR-001",
              descripcion: "Demo",
              precio: "1500.00",
              stock: "8",
              activo: true
            },
            {
              id: 6,
              nombre: "Producto Sin Stock",
              sku: "PR-002",
              descripcion: "Agotado",
              precio: "100.00",
              stock: "0",
              activo: true
            }
          ] as Producto[],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }
      throw new Error(`Endpoint no mockeado: ${endpoint}`);
    });

    mockRequest.mockResolvedValue({} as Venta);
  });

  it("crea una venta rapida y refresca el listado", async () => {
    render(<VentasPage />);

    const user = userEvent.setup();

    // Esperar a que el componente se renderice completamente
    await screen.findByLabelText(/Cliente/i);

    await user.selectOptions(screen.getByLabelText(/Cliente/i), "1");

    // Buscar el primer campo de producto en las líneas
    const productoSelect = screen.getAllByLabelText(/Producto/i)[0];
    await user.selectOptions(productoSelect, "5");

    // Llenar los campos de descripción automáticamente se llenan, pero necesitamos cantidad y precio
    const cantidadInput = screen.getAllByLabelText(/Cantidad/i)[0];
    await user.clear(cantidadInput);
    await user.type(cantidadInput, "2");

    const precioInput = screen.getAllByLabelText(/Precio unitario/i)[0];
    await user.clear(precioInput);
    await user.type(precioInput, "750");

    await user.click(screen.getByRole("button", { name: /Registrar venta/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/ventas/agregar-multiple/",
          data: expect.objectContaining({
            cliente: 1,
            lineas: [
              expect.objectContaining({
                producto: 5,
                descripcion: "Producto X",
                cantidad: "2",
                precio_unitario: "750"
              })
            ]
          })
        })
      );
    });

    await waitFor(() => {
      expect(recargarVentas).toHaveBeenCalled();
    });

    expect(await screen.findByText("Venta registrada correctamente")).toBeInTheDocument();
  });

  it("filtra ventas segun el termino ingresado", async () => {
    render(<VentasPage />);

    // Esperar a que el componente se renderice completamente
    const buscarInput = await screen.findByLabelText(/Buscar/i);

    expect(screen.getAllByText("Venta #V-10")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Venta #FA-0112")[0]).toBeInTheDocument();

    await userEvent.type(buscarInput, "Producto X");

    await waitFor(() => {
      expect(screen.getAllByText("Venta #V-10")[0]).toBeInTheDocument();
      expect(screen.queryByText("Venta #FA-0112")).not.toBeInTheDocument();
    });

    await userEvent.clear(buscarInput);
    await userEvent.type(buscarInput, "130000");

    await waitFor(() => {
      expect(screen.getAllByText("Venta #FA-0112")[0]).toBeInTheDocument();
    });
  });
});
