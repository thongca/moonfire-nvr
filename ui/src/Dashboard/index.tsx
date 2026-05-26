// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { FrameProps } from "../App";
import * as api from "../api";
import StatsBar from "./StatsBar";
import PriorityFeeds from "./PriorityFeeds";
import EventLog from "./EventLog";
import MotionActivity from "./MotionActivity";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  toplevel: api.ToplevelResponse;
}

export default function DashboardActivity({ Frame, toplevel }: Props) {
  return (
    <Frame>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          System Overview
        </Typography>
        <Box sx={{ mt: 3 }}>
          <StatsBar />
        </Box>
        <Box
          sx={{
            mt: 3,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 3,
          }}
        >
          <PriorityFeeds />
          <EventLog cameras={toplevel.cameras} />
        </Box>
        <MotionActivity />
      </Container>
    </Frame>
  );
}
