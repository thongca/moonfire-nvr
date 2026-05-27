// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

/**
 * @fileoverview User Permissions sub-section for the Settings page.
 */

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import { shellTokens } from "../theme";

export default function UserPermissions() {
  const [users, setUsers] = useState<api.UserWithId[] | null>(null);
  const snackbars = useSnackbars();

  useEffect(() => {
    const controller = new AbortController();

    api.users({ signal: controller.signal }).then((result) => {
      if (result.status === "aborted") return;
      if (result.status === "success") {
        setUsers(result.response.users);
      } else {
        snackbars.enqueue({ message: result.message });
        setUsers([]);
      }
    });

    return () => {
      controller.abort();
    };
  }, [snackbars]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, color: shellTokens.text.primary }}
        >
          User Permissions
        </Typography>
      </Box>

      {/* Table */}
      <TableContainer
        sx={{
          border: `1px solid ${shellTokens.border.subtle}`,
          borderRadius: `${shellTokens.radius.base / 8}px`,
          bgcolor: shellTokens.surface.panel,
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Username", "Role"].map((col) => (
                <TableCell
                  key={col}
                  sx={{
                    color: shellTokens.text.secondary,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${shellTokens.border.subtle}`,
                    py: 1.25,
                  }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {users === null ? (
              <TableRow>
                <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map(({ id, user }) => {
                const isAdmin = user.permissions?.adminUsers === true;
                return (
                  <TableRow key={id} sx={{ "&:last-child td": { border: 0 } }}>
                    {/* Username */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, color: shellTokens.text.primary }}
                      >
                        {user.username ?? "—"}
                      </Typography>
                    </TableCell>

                    {/* Role badge */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Box
                        component="span"
                        sx={
                          isAdmin
                            ? {
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                                color: "#ff9800",
                                bgcolor: "rgba(255, 152, 0, 0.12)",
                                border: "1px solid rgba(255, 152, 0, 0.3)",
                                px: 1,
                                py: 0.375,
                                borderRadius: 0.5,
                              }
                            : {
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                                color: shellTokens.text.secondary,
                                bgcolor: "rgba(184, 173, 164, 0.1)",
                                border: `1px solid rgba(184, 173, 164, 0.2)`,
                                px: 1,
                                py: 0.375,
                                borderRadius: 0.5,
                              }
                        }
                      >
                        {isAdmin ? "Admin" : "Viewer"}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
