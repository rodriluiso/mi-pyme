import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanzasPage from "@/pages/finanzas/FinanzasPage";
import type { Cliente, MovimientoFinanciero, PagoCliente } from "@/types/mipyme";

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

describe("FinanzasPage", () => {
  const recargarPagos = vi.fn();
  const recargarMovimientos = vi.fn();
  const recargarGastos = vi.fn();

  beforeEach(() => {
    mockRequest.mockReset();
    recargarPagos.mockReset();
    recargarPagos.mockResolvedValue(undefined);
    recargarMovimientos.mockReset();
    recargarMovimientos.mockResolvedValue(undefined);
    recargarGastos.mockReset();
    recargarGastos.mockResolvedValue(undefined);

    mockUseListado.mockImplementation((endpoint: string) => {
      if (endpoint === "/clientes/") {
        return {
          datos: [
            {
              id: 1,
              nombre: "Cliente Demo",
              identificacion: "20123456789",
              correo: "demo@mipyme.com",
              telefono: "1112345678",
              direccion: "Av. Siempre Viva",
              saldo: "1000.00"
            } satisfies Cliente
          ],
          cargando: false,
          error: null,
          recargar: vi.fn()
        };
      }

      if (endpoint === "/finanzas/pagos/") {
        return {
          datos: [] as PagoCliente[],
          cargando: false,
          error: null,
          recargar: recargarPagos
        };
      }

      if (endpoint === "/finanzas/movimientos/efectivo-real/") {
        return {
          datos: [] as MovimientoFinanciero[],
          cargando: false,
          error: null,
          recargar: recargarMovimientos
        };
      }

      if (endpoint.startsWith("/finanzas/movimientos/gastos/")) {
        return {
          datos: [] as MovimientoFinanciero[],
          cargando: false,
          error: null,
          recargar: recargarGastos
        };
      }

      throw new Error(`Endpoint no mockeado: ${endpoint}`);
    });

    mockRequest.mockImplementation((options: { url: string; method?: string; data?: unknown }) => {
      const metodo = options.method ?? "GET";
      if (metodo === "GET" && options.url === "/finanzas/movimientos/resumen/pendiente/") {
        return Promise.resolve({
          total_ventas: "130000.00",
          total_pagos: "30000.00",
          pendiente_cobro: "100000.00",
          total_compras: "805815.93",
          total_gastos: "12500.00"
        });
      }

      if (metodo === "POST" && options.url === "/finanzas/pagos/") {
        return Promise.resolve({});
      }

      if (metodo === "POST" && options.url === "/finanzas/movimientos/registrar-gasto/") {
        return Promise.resolve({});
      }

      throw new Error(`URL no mockeada: ${options.url}`);
    });
  });

  it("registra un pago y refresca los datos", async () => {
    render(<FinanzasPage />);

    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Cliente/i), "1");
    await user.type(screen.getByLabelText(/Monto \*/i, { selector: "#pago-monto" }), "2500");
    await user.selectOptions(screen.getByLabelText(/Medio/i, { selector: "#pago-medio" }), "TRANSFERENCIA");
    await user.clear(screen.getByLabelText(/Observacion/i, { selector: "#pago-observacion" }));
    await user.type(screen.getByLabelText(/Observacion/i, { selector: "#pago-observacion" }), "Pago por transferencia");

    await user.click(screen.getByRole("button", { name: /Registrar pago/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/finanzas/pagos/",
          data: expect.objectContaining({
            cliente: 1,
            monto: "2500",
            medio: "TRANSFERENCIA",
            observacion: "Pago por transferencia",
            fecha: expect.any(String)
          })
        })
      );
    });

    await waitFor(() => {
      expect(recargarPagos).toHaveBeenCalled();
    });

    expect(await screen.findByText("Pago registrado correctamente")).toBeInTheDocument();
  });

  it("registra un gasto y refresca los datos", async () => {
    render(<FinanzasPage />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/Tipo de gasto/i), "IMPUESTO");
    await user.clear(screen.getByLabelText(/Monto \*/i, { selector: "#gasto-monto" }));
    await user.type(screen.getByLabelText(/Monto \*/i, { selector: "#gasto-monto" }), "1800");
    await user.selectOptions(screen.getByLabelText(/Medio \*/i, { selector: "#gasto-medio" }), "EFECTIVO");
    await user.clear(screen.getByLabelText(/Observacion/i, { selector: "#gasto-observacion" }));
    await user.type(screen.getByLabelText(/Observacion/i, { selector: "#gasto-observacion" }), "IVA mensual");

    await user.click(screen.getByRole("button", { name: /Registrar gasto/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/finanzas/movimientos/registrar-gasto/",
          data: expect.objectContaining({
            tipo: "IMPUESTO",
            monto: "1800",
            medio_pago: "EFECTIVO",
            observacion: "IVA mensual",
            fecha: expect.any(String)
          })
        })
      );
    });

    await waitFor(() => {
      expect(recargarGastos).toHaveBeenCalled();
    });

    expect(await screen.findByText("Gasto registrado correctamente")).toBeInTheDocument();
  });

  it("aplica filtro de gastos", async () => {
    render(<FinanzasPage />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/Desde/i));
    await user.type(screen.getByLabelText(/Desde/i), "2025-01-01");
    await user.clear(screen.getByLabelText(/Hasta/i));
    await user.type(screen.getByLabelText(/Hasta/i), "2025-01-31");

    await user.click(screen.getByRole("button", { name: /Aplicar filtro/i }));

    await waitFor(() => {
      expect(mockUseListado).toHaveBeenCalledWith(
        "/finanzas/movimientos/gastos/?fecha__gte=2025-01-01&fecha__lte=2025-01-31"
      );
    });
  });
});
