// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { FrameProps } from "../App";
import StatsBar from "./StatsBar";

interface Props {
  Frame: React.ComponentType<FrameProps>;
}

export default function DashboardActivity({ Frame }: Props) {
  return (
    <Frame>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          System Overview
        </Typography>
        <Box sx={{ mt: 3 }}>
          <StatsBar />
        </Box>
      </Container>
    </Frame>
  );
}
