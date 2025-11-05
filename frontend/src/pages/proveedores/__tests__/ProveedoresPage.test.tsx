import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProveedoresPage from "@/pages/proveedores/ProveedoresPage";
import type { Proveedor } from "@/types/mipyme";

const mockRecargar = vi.fn();
const mockRequest = vi.fn();

window.scrollTo = vi.fn();

const proveedorDemo: Proveedor = {
  id: 1,
  nombre: "Proveedor Demo",
  identificacion: "30-12345678-9",
  contacto: "Juan Perez",
  telefono: "1122334455",
  correo: "ventas@demo.com",
  direccion: "Calle Falsa 123",
  notas: "Entrega semanal",
  activo: true,
  total_compras: "1000.00",
  total_pagado: "400.00",
  saldo: "600.00"
};

const mockUseListado = vi.fn();

vi.mock("@/hooks/useListado", () => ({
  useListado: (endpoint: string) => mockUseListado(endpoint)
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

describe("ProveedoresPage", () => {
  beforeEach(() => {
    mockRecargar.mockReset();
    mockRecargar.mockResolvedValue(undefined);
    mockRequest.mockReset();
    mockUseListado.mockImplementation((endpoint: string) => {
      if (endpoint === "/proveedores/") {
        return {
          datos: [proveedorDemo],
          cargando: false,
          error: null,
          recargar: mockRecargar
        };
      }
      throw new Error(`Endpoint no mockeado: ${endpoint}`);
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ProveedoresPage />
      </MemoryRouter>
    );

  it("crea un proveedor y refresca el listado", async () => {
    mockRequest.mockImplementation(({ method, url }) => {
      if (method === "POST" && url === "/proveedores/") {
        return Promise.resolve({} as Proveedor);
      }
      throw new Error(`URL no mockeada: ${method} ${url}`);
    });

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Agregar proveedor/i }));

    await user.clear(screen.getByLabelText(/Nombre/i));
    await user.type(screen.getByLabelText(/Nombre/i), "Proveedor Alfa");
    await user.type(screen.getByLabelText(/Identificacion/i), "30-00000000-0");
    await user.type(screen.getByLabelText(/Contacto/i), "Carlos");
    await user.type(screen.getByLabelText(/Telefono/i), "1199999999");
    await user.type(screen.getByLabelText(/Correo/i), "alfa@example.com");

    await user.click(screen.getByRole("button", { name: /Guardar proveedor/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST", url: "/proveedores/" })
      );
    });

    await waitFor(() => {
      expect(mockRecargar).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Proveedor creado correctamente/i)).toBeInTheDocument();
  });

  it("permite editar y borrar un proveedor", async () => {
    mockRequest.mockImplementation(({ method, url }) => {
      if (method === "PUT" && url === "/proveedores/1/") {
        return Promise.resolve({} as Proveedor);
      }
      if (method === "DELETE" && url === "/proveedores/1/") {
        return Promise.resolve();
      }
      throw new Error(`URL no mockeada: ${method} ${url}`);
    });

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Modificar/i }));
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue("Proveedor Demo");

    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "PUT", url: "/proveedores/1/" })
      );
    });

    window.confirm = vi.fn().mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /Borrar/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "DELETE", url: "/proveedores/1/" })
      );
    });
  });

  it("registra un pago a proveedor y refresca el saldo", async () => {
    mockRequest.mockImplementation(({ method, url }) => {
      if (method === "POST" && url === "/finanzas/pagos-proveedores/") {
        return Promise.resolve({});
      }
      throw new Error(`URL no mockeada: ${method} ${url}`);
    });

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Ingresar pago/i }));
    expect(screen.getByLabelText(/Proveedor/i)).toHaveValue("1");

    await user.type(screen.getByLabelText(/Monto \*/i), "250");
    await user.selectOptions(screen.getByLabelText(/Medio \*/i), "CHEQUE");
    await user.clear(screen.getByLabelText(/Observacion/i));
    await user.type(screen.getByLabelText(/Observacion/i), "Pago parcial");

    await user.click(screen.getByRole("button", { name: /Registrar pago/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/finanzas/pagos-proveedores/",
          data: expect.objectContaining({
            proveedor: 1,
            monto: "250",
            medio: "CHEQUE",
            observacion: "Pago parcial"
          })
        })
      );
    });

    await waitFor(() => {
      expect(mockRecargar).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Pago registrado correctamente/i)).toBeInTheDocument();
  });
});
