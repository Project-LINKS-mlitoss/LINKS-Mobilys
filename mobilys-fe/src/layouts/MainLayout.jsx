// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
	AppBar,
	Toolbar,
	Box,
	IconButton,
} from "@mui/material";
import SideNavbar from "../components/SideNavbar";
import { useAuthStore } from "../state/authStore";
import MenuIcon from "@mui/icons-material/Menu";

export default function MainLayout({ children }) {
	const isLoggedIn = useAuthStore(
		(state) => state.access !== null && state.access !== "null"
	);
	const [navOpen, setNavOpen] = React.useState(true);
	const toggleNav = () => setNavOpen((prev) => !prev);

	return (
		<Box sx={{ display: "flex" }}>
			{isLoggedIn && (
				<AppBar
					position='fixed'
					sx={{
						zIndex: (theme) => theme.zIndex.drawer + 1,
						backgroundColor: "#fff",
						color: "black",
						boxShadow: "none",
						width: "100%",
					}}>
					{isLoggedIn && !navOpen && (
						<IconButton
							edge='start'
							onClick={toggleNav}
							sx={{
								position: "fixed",
								top: 16,
								left: 16,
								zIndex: (theme) => theme.zIndex.drawer + 1,
							}}>
							<MenuIcon />
						</IconButton>
					)}

					<Toolbar sx={{ display: "flex", justifyContent: "flex-end" }}>
					</Toolbar>
				</AppBar>
			)}
			{isLoggedIn && navOpen && (
				<SideNavbar closable open={navOpen} onToggle={toggleNav} />
			)}
			<Box
				component='main'
				sx={{
					flexGrow: 1,
					p: 3,
					transition: (theme) =>
						theme.transitions.create("margin", {
							easing: theme.transitions.easing.sharp,
							duration: theme.transitions.duration.enteringScreen,
						}),
				}}>
				<Toolbar />
				{children}
			</Box>
		</Box>
	);
}
