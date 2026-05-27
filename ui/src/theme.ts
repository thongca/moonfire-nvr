import { createTheme } from "@mui/material/styles";

export const shellTokens = {
  background: {
    base: "#131313",
  },
  surface: {
    panel: "#1c1b1b",
    raised: "#201f1f",
    table: "#2a2a2a",
    overlay: "#353534",
  },
  primary: {
    fireOrange: "#ff5722",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.12)",
  },
  text: {
    primary: "#f5f5f5",
    secondary: "#a7a29d",
  },
  radius: {
    base: 12,
  },
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: shellTokens.background.base,
      paper: shellTokens.surface.panel,
    },
    primary: {
      main: shellTokens.primary.fireOrange,
      contrastText: "#ffffff",
    },
    text: {
      primary: shellTokens.text.primary,
      secondary: shellTokens.text.secondary,
    },
    divider: shellTokens.border.subtle,
    header: shellTokens.surface.raised,
    headerContrastText: shellTokens.text.primary,
  },
  shape: {
    borderRadius: shellTokens.radius.base,
  },
  typography: {
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif",
  },
});
