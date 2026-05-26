// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Typography from "@mui/material/Typography";

interface Props {
  serverVersion?: string;
}

export default function SystemUpdates(_props: Props) {
  return <Typography>System Updates</Typography>;
}
