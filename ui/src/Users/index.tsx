// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2022 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow, { TableRowProps } from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import * as api from "../api";
import { FrameProps } from "../App";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import DeleteDialog from "./DeleteDialog";
import AddEditDialog from "./AddEditDialog";
import React from "react";

interface Props {
  Frame: (props: FrameProps) => React.JSX.Element;
  csrf?: string;
}

interface RowProps extends TableRowProps {
  userId: React.ReactNode;
  userName: React.ReactNode;
  permissions?: React.ReactNode;
  gutter?: React.ReactNode;
}

/// More menu attached to a particular user row.
interface More {
  user: api.UserWithId;
  anchor: HTMLElement;
}

const Row = ({ userId, userName, permissions, gutter, ...rest }: RowProps) => (
  <TableRow {...rest}>
    <TableCell align="right">{userId}</TableCell>
    <TableCell>{userName}</TableCell>
    <TableCell>{permissions}</TableCell>
    <TableCell>{gutter}</TableCell>
  </TableRow>
);

const PERMISSIONS = [
  ["adminUsers", "Admin users"],
  ["readCameraConfigs", "Read camera configs"],
  ["updateSignals", "Update signals"],
  ["viewVideo", "View video"],
] as const;

function PermissionChips({ permissions }: { permissions?: api.Permissions }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {PERMISSIONS.filter(([key]) => permissions?.[key]).map(([, label]) => (
        <Chip key={label} label={label} size="small" />
      ))}
    </Box>
  );
}

const Main = ({ Frame, csrf }: Props) => {
  const [users, setUsers] = useState<
    api.FetchResult<api.UsersResponse> | undefined
  >();
  const [more, setMore] = useState<undefined | More>();
  const [fetchSeq, setFetchSeq] = useState(0);
  const [userToEdit, setUserToEdit] = useState<
    undefined | null | api.UserWithId
  >();
  const [deleteUser, setDeleteUser] = useState<undefined | api.UserWithId>();
  const refetch = () => setFetchSeq((s) => s + 1);
  useEffect(() => {
    const abort = new AbortController();
    const doFetch = async (signal: AbortSignal) => {
      setUsers(await api.users({ signal }));
    };
    doFetch(abort.signal);
    return () => {
      abort.abort();
    };
  }, [fetchSeq]);

  return (
    <Frame>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <Row
              userId="id"
              userName="username"
              permissions="permissions"
              gutter={
                <IconButton
                  aria-label="add"
                  onClick={(e) => setUserToEdit(null)}
                >
                  <AddIcon />
                </IconButton>
              }
            />
          </TableHead>
          <TableBody>
            {users === undefined && (
              <Row
                role="progressbar"
                userId={<Skeleton />}
                userName={<Skeleton />}
              />
            )}
            {users?.status === "error" && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Alert severity="error">{users.message}</Alert>
                </TableCell>
              </TableRow>
            )}
            {users?.status === "success" &&
              users.response.users.map((u) => (
                <Row
                  key={u.id}
                  userId={u.id}
                  userName={u.user.username}
                  permissions={<PermissionChips permissions={u.user.permissions} />}
                  gutter={
                    <IconButton
                      aria-label="more"
                      onClick={(e) =>
                        setMore({
                          user: u,
                          anchor: e.currentTarget,
                        })
                      }
                    >
                      <MoreVertIcon />
                    </IconButton>
                  }
                />
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Menu
        anchorEl={more?.anchor}
        open={more !== undefined}
        onClose={() => setMore(undefined)}
      >
        <MenuItem
          onClick={() => {
            setUserToEdit(more?.user);
            setMore(undefined);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem>
          <Typography
            color="error"
            onClick={() => {
              setDeleteUser(more?.user);
              setMore(undefined);
            }}
          >
            Delete
          </Typography>
        </MenuItem>
      </Menu>
      {userToEdit !== undefined && (
        <AddEditDialog
          prior={userToEdit}
          refetch={refetch}
          onClose={() => setUserToEdit(undefined)}
          csrf={csrf}
        />
      )}
      <DeleteDialog
        userToDelete={deleteUser}
        refetch={refetch}
        onClose={() => setDeleteUser(undefined)}
        csrf={csrf}
      />
    </Frame>
  );
};

export default Main;
