// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SnackbarProvider } from "./snackbars";
import React from "react";
import { theme } from "./theme";

export function renderWithCtx(
  children: React.ReactNode,
  options: { initialEntries?: string[] } = {},
): Pick<ReturnType<typeof render>, "rerender"> {
  function wrapped(children: React.ReactNode) {
    return (
      <ThemeProvider theme={theme}>
        <SnackbarProvider autoHideDuration={5000}>
          <MemoryRouter initialEntries={options.initialEntries}>{children}</MemoryRouter>
        </SnackbarProvider>
      </ThemeProvider>
    );
  }
  const { rerender } = render(wrapped(children));
  return {
    rerender: (children: React.ReactNode) => rerender(wrapped(children)),
  };
}
