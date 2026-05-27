// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { ThemeProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import "@fontsource/roboto";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { SnackbarProvider } from "./snackbars";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import "./index.css";
import { HashRouter } from "react-router";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";
const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <SnackbarProvider autoHideDuration={5000}>
            <HashRouter>
              <App />
            </HashRouter>
          </SnackbarProvider>
        </LocalizationProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
