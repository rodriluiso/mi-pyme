import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import type { Cliente, Compra, PagoCliente, ResumenPendiente, Venta } from "@/types/mipyme";

type MockResponseMap = Record<string, unknown>;

const mockResponses: MockResponseMap = {
  "/clientes/": [
    {
      id: 1,
      nombre: "Cliente Demo",
      identificacion: "20304050",
      direccion: "Calle Falsa 123",
      telefono: "123456",
      correo: "demo@mipyme.com"
    } satisfies Cliente
  ],
  "/ventas/": [
    {
      id: 10,
      fecha: "2025-01-15",
      numero: "V-10",
      cliente: 1,
      cliente_nombre: "Cliente Demo",
      total: "1500.00",
      lineas: []
    } satisfies Venta
  ],
  "/compras/": [
    {
      id: 5,
      fecha: "2025-01-10",
      numero: "C-5",
      proveedor: 2,
      proveedor_nombre: "Proveedor Demo",
      categoria: null,
      categoria_nombre: null,
      total: "800.00",
      notas: "",
      lineas: []
    } satisfies Compra
  ],
  "/finanzas/pagos/": [
    {
      id: 3,
      fecha: "2025-01-16",
      cliente: 1,
      cliente_nombre: "Cliente Demo",
      monto: "500.00",
      medio: "EFECTIVO",
      medio_display: "Efectivo",
      observacion: "Pago parcial"
    } satisfies PagoCliente
  ],
  "/finanzas/movimientos/resumen/pendiente/": {
    total_ventas: "1500.00",
    total_pagos: "500.00",
    pendiente_cobro: "1000.00"
  } satisfies ResumenPendiente
};

const mockRequest = vi.fn(async ({ url }: { url?: string }) => {
  if (!url) {
    throw new Error("Solicitud sin URL");
  }
  const respuesta = mockResponses[url];
  if (respuesta === undefined) {
    throw new Error(`URL no mockeada: ${url}`);
  }
  return respuesta;
});

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mockRequest.mockClear();
  });

  it("muestra indicadores y listados basados en el backend", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Tablero general")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: "/clientes/" }));
    });

    expect(screen.getByText("Clientes")).toBeInTheDocument();

    const coincidenciasCliente = await screen.findAllByText("Cliente Demo");
    expect(coincidenciasCliente.length).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText("Pagos recibidos")).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(5);
  });
});
