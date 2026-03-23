
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../src/lib/supabase";

type Step = {
	id: number;
	title: string;
	description: string;
};

const STEPS: Step[] = [
	{ id: 1, title: "Opportunity Discovery", description: "Identify overseas markets, buyers, and product fit." },
	{ id: 2, title: "Company Setup", description: "Register your business, get licences and necessary documentation." },
	{ id: 3, title: "Sample Approval", description: "Prepare and send product samples; iterate until buyer approval." },
	{ id: 4, title: "Bank Funding", description: "Access working capital and export finance to scale production." },
];

export default function Home() {
	const [loading, setLoading] = useState(false);
	const [currentStep, setCurrentStep] = useState<number | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [profileName, setProfileName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// auth form state
	const [authMode, setAuthMode] = useState<"signup" | "signin" | null>(null);
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [authName, setAuthName] = useState("");
	const [authMobile, setAuthMobile] = useState("");
	const [authIndustry, setAuthIndustry] = useState("");
	const [authLoading, setAuthLoading] = useState(false);
	const [authMessage, setAuthMessage] = useState<string | null>(null);
	const [authMessageType, setAuthMessageType] = useState<"error" | "success" | "info">("info");

	function normalizeAuthError(message: string) {
		const lower = message.toLowerCase();
		if (
			lower.includes("already registered") ||
			lower.includes("already exists") ||
			lower.includes("already used") ||
			lower.includes("user already registered") ||
			(lower.includes("duplicate") && lower.includes("email")) ||
			(lower.includes("unique") && lower.includes("email"))
		) {
			return "That email is already in use. Please sign in instead.";
		}
		return message;
	}

	useEffect(() => {
		let mounted = true;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();

				if (!user) {
					// no logged-in user
					if (mounted) {
						setUserId(null);
						setProfileName(null);
					}
					setLoading(false);
					return;
				}

				if (mounted) setUserId(user.id);

				// fetch profile name for display
				try {
					const { data: profileRows } = await supabase
						.from("profiles")
						.select("name")
						.eq("user_id", user.id)
						.limit(1);

					const profile = profileRows?.[0] ?? null;
					if (mounted && profile?.name) setProfileName(profile.name);
				} catch (e) {
					console.error("failed to fetch profile name", e);
				}

				// fetch current_step from user_journey table
				const { data: journeyRows, error } = await supabase.from("user_journey").select("current_step").eq("user_id", user.id).limit(1);

				if (error) {
					console.error("Supabase query error", error);
					if (mounted) setError(error.message);
				} else if (journeyRows?.[0]?.current_step != null) {
					if (mounted) setCurrentStep(Number(journeyRows[0].current_step));
				} else {
					// no row yet
					if (mounted) setCurrentStep(null);
				}
			} catch (err: any) {
				console.error(err);
				if (mounted) setError(String(err.message || err));
			} finally {
				if (mounted) setLoading(false);
			}
		}

		load();

		// listen for auth changes (ensure profile and journey rows exist)
		const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
			if (session?.user) {
				setError(null);
				setUserId(session.user.id);
				// set profile name if exists
				try {
					const { data: profileRows, error: profileErr } = await supabase
						.from("profiles")
						.select("name")
						.eq("user_id", session.user.id)
						.limit(1);

					const profile = profileRows?.[0] ?? null;
					if (!profileErr && profile?.name) setProfileName(profile.name);
				} catch (e) {
					console.error(e);
				}
				// ensure profile and user_journey rows exist and fetch current_step
				(async () => {
					try {
						const { data: profileRows, error: profileErr } = await supabase
							.from("profiles")
							.select("*")
							.eq("user_id", session.user.id)
							.limit(1);

						const profile = profileRows?.[0] ?? null;

						if (profileErr) console.error("profile fetch error", profileErr);

						// use metadata from the auth session (populated at sign up) when available
						const metadata = (session.user as any)?.user_metadata ?? (session.user as any)?.user_metadata ?? {};
						const metaName = metadata?.name ?? null;
						const metaMobile = metadata?.mobile ?? null;
						const metaIndustry = metadata?.industry ?? null;
						const email = session.user.email ?? null;

						if (!profile) {
							// create profile row using metadata when possible
							// include `id` populated with auth user id in case the table requires it
							await supabase.from("profiles").upsert({
								id: session.user.id,
								user_id: session.user.id,
								name: metaName,
								mobile: metaMobile,
								industry: metaIndustry,
								email,
							});
						} else {
							// ensure existing profile has at least a name/email; update if missing but metadata exists
							const updates: any = { id: session.user.id, user_id: session.user.id };
							let needsUpdate = false;
							if ((!profile.name || profile.name === null) && metaName) {
								updates.name = metaName;
								needsUpdate = true;
							}
							if ((!profile.mobile || profile.mobile === null) && metaMobile) {
								updates.mobile = metaMobile;
								needsUpdate = true;
							}
							if ((!profile.industry || profile.industry === null) && metaIndustry) {
								updates.industry = metaIndustry;
								needsUpdate = true;
							}
							if ((!profile.email || profile.email === null) && email) {
								updates.email = email;
								needsUpdate = true;
							}
							if (needsUpdate) {
								await supabase.from("profiles").upsert(updates);
							}
						}

						const { data: journeyRows, error } = await supabase
							.from("user_journey")
							.select("current_step")
							.eq("user_id", session.user.id)
							.limit(1);

						if (!error && journeyRows?.[0]?.current_step != null) setCurrentStep(Number(journeyRows[0].current_step));
						else {
							// create default journey row
							await supabase.from("user_journey").upsert({ user_id: session.user.id, current_step: 1 });
							setCurrentStep(1);
						}
					} catch (e) {
						console.error(e);
					}
				})();
			} else {
				setUserId(null);
				setProfileName(null);
				setCurrentStep(null);
			}
		});

		return () => {
			mounted = false;
			listener.subscription.unsubscribe();
		};
	}, []);

	function renderBadge(stepId: number) {
		if (currentStep != null && stepId < currentStep) {
			// completed
			return (
				<span className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-100/60 px-2 py-0.5 rounded">
					<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-700" viewBox="0 0 20 20" fill="currentColor">
						<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 5.293 11.879a1 1 0 111.414-1.414L8.414 12.172l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" />
					</svg>
					Completed
				</span>
			);
		}
		if (currentStep === stepId) {
			return <span className="inline-flex items-center px-2 py-0.5 rounded text-sm bg-blue-100 text-blue-700">Current</span>;
		}
		return null;
	}


	async function handleSignUp(e?: React.FormEvent) {
		e?.preventDefault();
		setAuthLoading(true);
		setAuthMessage(null);
		setAuthMessageType("info");
		try {
			// Check email existence server-side so we can warn immediately on the signup form.
			// (Without this, Supabase can respond with a generic success message even when the email exists.)
			const checkRes = await fetch("/api/auth/check-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: authEmail.trim().toLowerCase() }),
			});
			if (!checkRes.ok) {
				// Fail closed: if we can't verify, don't send the generic signup success.
				let serverErr = "";
				try {
					serverErr = (await checkRes.json())?.error ?? "";
				} catch {
					// ignore
				}
				setAuthMessage(serverErr ? `Could not verify email: ${serverErr}` : "Could not verify email at this time.");
				setAuthMessageType("error");
				return;
			}

			const checkJson = (await checkRes.json()) as { exists?: boolean };
			if (checkJson && (checkJson as any).error) {
				setAuthMessage(`Could not verify email: ${(checkJson as any).error}`);
				setAuthMessageType("error");
				return;
			}
			if (checkJson?.exists) {
				setAuthMessage("That email is already in use. Please sign in instead.");
				setAuthMessageType("error");
				return;
			}

			// include profile fields as user_metadata so they persist through email confirmation
			const { data, error } = await supabase.auth.signUp({
				email: authEmail,
				password: authPassword,
				options: { data: { name: authName, mobile: authMobile, industry: authIndustry } },
			});
			if (error) {
				setAuthMessage(normalizeAuthError(error.message));
				setAuthMessageType("error");
				return;
			}

			const userId = data?.user?.id ?? null;
			// if supabase returns a user id immediately, store profile and journey
			if (userId) {
				// Supabase may not always throw a hard "already registered" error.
				// When it signs in an existing user, `created_at` will be older than a brand-new signup.
				const createdAtRaw = (data.user as any)?.created_at as string | undefined;
				let likelyDuplicate = false;
				if (createdAtRaw) {
					const createdAt = new Date(createdAtRaw).getTime();
					if (!Number.isNaN(createdAt)) {
						// If the user existed before "just now", treat it as duplicate email.
						likelyDuplicate = Date.now() - createdAt > 2 * 60 * 1000;
					}
				}

				if (likelyDuplicate) {
					setAuthMessage("That email is already in use. Please sign in instead.");
					setAuthMessageType("error");
					return;
				}

				// If the email already existed, Supabase may sign the user in immediately.
				// Detect that case so we can show a warning instead of silently navigating away.
				const { data: existingProfilesRows } = await supabase
					.from("profiles")
					.select("user_id")
					.eq("user_id", userId)
					.limit(1);

				const { data: existingJourneyRows } = await supabase
					.from("user_journey")
					.select("user_id")
					.eq("user_id", userId)
					.limit(1);

				const alreadyHasProfile = (existingProfilesRows?.length ?? 0) > 0;
				const alreadyHasJourney = (existingJourneyRows?.length ?? 0) > 0;
				const alreadyAccount = alreadyHasProfile || alreadyHasJourney;

				if (alreadyAccount) {
					setAuthMessage("That email is already in use. You're signed in.");
					setAuthMessageType("error");
					return;
				}

				// New user: populate `id` as well in case the profiles table expects a non-null id field.
				await supabase.from("profiles").upsert({ id: userId, user_id: userId, name: authName, mobile: authMobile, industry: authIndustry, email: authEmail });
				await supabase.from("user_journey").upsert({ user_id: userId, current_step: 1 });
			}

			setAuthMessage(
				"Sign up requested. Check your email to confirm (if required). If your account is active, you'll be signed in automatically."
			);
			setAuthMessageType("success");
			setAuthMode(null);
			setAuthEmail("");
			setAuthPassword("");
			setAuthName("");
			setAuthMobile("");
			setAuthIndustry("");
		} catch (err: any) {
			const msg = String(err.message || err);
			setAuthMessage(normalizeAuthError(msg));
			setAuthMessageType("error");
		} finally {
			setAuthLoading(false);
		}
	}

	async function handleSignIn(e?: React.FormEvent) {
		e?.preventDefault();
		setAuthLoading(true);
		setAuthMessage(null);
		setAuthMessageType("info");
		try {
			const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
			if (error) {
				setAuthMessage(normalizeAuthError(error.message));
				setAuthMessageType("error");
				return;
			}
			const user = data.user;
			if (user) {
				setUserId(user.id);
				const { data: rowRows, error: rowErr } = await supabase
					.from("user_journey")
					.select("current_step")
					.eq("user_id", user.id)
					.limit(1);
				if (!rowErr && rowRows?.[0]?.current_step != null) setCurrentStep(Number(rowRows[0].current_step));
			}
			setAuthMessage("Signed in successfully.");
			setAuthMessageType("success");
			setAuthMode(null);
			setAuthEmail("");
			setAuthPassword("");
		} catch (err: any) {
			const msg = String(err.message || err);
			setAuthMessage(normalizeAuthError(msg));
			setAuthMessageType("error");
		} finally {
			setAuthLoading(false);
		}
	}

	async function handleSignOut() {
		await supabase.auth.signOut();
		setUserId(null);
		setCurrentStep(null);
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 flex items-center justify-center p-8">
			<div className="max-w-5xl w-full">
				{/* Hero */}
				<header className="text-center mb-6">
					<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
						From Artisan to Exporter (from Jaipur to the World)
					</h1>
					<p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
						A simple, guided path for novice manufacturers to prepare products and start exporting.
					</p>
					<div className="mt-6 flex items-center justify-center gap-4">
						<a id="get-started" href="#journey" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-md shadow">
							Get Started
						</a>

						{userId ? (
							<button onClick={handleSignOut} className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md">
								Sign Out
							</button>
						) : (
							<>
								<button onClick={() => setAuthMode("signin")} className="inline-block bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-2 rounded-md">
									Sign In
								</button>
								<button onClick={() => setAuthMode("signup")} className="inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">
									Sign Up
								</button>
							</>
						)}
					</div>

					{/* Auth form (simple inline modal) */}
					{authMode && (
						<div className="mt-6 flex justify-center">
							<form onSubmit={authMode === "signup" ? handleSignUp : handleSignIn} className="w-full max-w-md bg-white dark:bg-zinc-900 border rounded-lg p-4 shadow">
								<h4 className="text-lg font-medium mb-2">{authMode === "signup" ? "Create an account" : "Sign in"}</h4>

								{authMessage && (
									<div
										className={`text-sm mb-2 ${
											authMessageType === "error"
												? "text-red-600 dark:text-red-400"
												: authMessageType === "success"
												? "text-green-700 dark:text-green-300"
												: "text-zinc-700 dark:text-zinc-200"
										}`}
									>
										{authMessage}
									</div>
								)}

								{authMode === "signup" && (
									<>
										<label className="block text-sm mb-1">Name</label>
										<input value={authName} onChange={(e) => setAuthName(e.target.value)} type="text" required className="w-full mb-2 px-3 py-2 border rounded bg-zinc-50 dark:bg-zinc-800" />
										<label className="block text-sm mb-1">Mobile number</label>
										<input value={authMobile} onChange={(e) => setAuthMobile(e.target.value)} type="tel" required className="w-full mb-2 px-3 py-2 border rounded bg-zinc-50 dark:bg-zinc-800" />
										<label className="block text-sm mb-1">Industry</label>
										<input value={authIndustry} onChange={(e) => setAuthIndustry(e.target.value)} type="text" required className="w-full mb-2 px-3 py-2 border rounded bg-zinc-50 dark:bg-zinc-800" />
									</>
								)}

								<label className="block text-sm mb-1">Email</label>
								<input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} type="email" required className="w-full mb-2 px-3 py-2 border rounded bg-zinc-50 dark:bg-zinc-800" />

								<label className="block text-sm mb-1">Password</label>
								<input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} type="password" required className="w-full mb-3 px-3 py-2 border rounded bg-zinc-50 dark:bg-zinc-800" />

								<div className="flex items-center justify-between">
									<button type="submit" disabled={authLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
										{authLoading ? "Processing..." : authMode === "signup" ? "Sign Up" : "Sign In"}
									</button>
									<button
										type="button"
										onClick={() => {
											setAuthMode(null);
											setAuthMessage(null);
											setAuthMessageType("info");
										}}
										className="text-sm text-zinc-600 hover:underline"
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}
				</header>

				{/* Journey Tracker */}
				<section aria-labelledby="journey" className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur rounded-2xl p-6 sm:p-8 shadow">
					<div className="flex items-start justify-between">
						<h2 id="journey" className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
							Journey Tracker
						</h2>
						<div className="text-sm text-zinc-600 dark:text-zinc-400">
							{loading ? "Loading..." : userId ? `User: ${profileName ?? userId}` : "Not signed in"}
						</div>
					</div>

					{error && <div className="text-sm text-red-600 mb-4">Error: {error}</div>}

					{!authMode && authMessage && (
						<div className={`text-sm mb-4 ${authMessageType === "error" ? "text-red-600" : authMessageType === "success" ? "text-green-700" : "text-zinc-700"}`}>
							{authMessage}
						</div>
					)}

					<ol className="grid grid-cols-1 sm:grid-cols-4 gap-4">
						{STEPS.map((step) => {
							const completed = currentStep != null && step.id < currentStep;
							const current = currentStep === step.id;
							const isOpportunityDiscovery = step.id === 1;
							const isCompanySetup = step.id === 2;
							return (
								<li
									key={step.id}
									className={`flex flex-col gap-3 p-4 rounded-lg border ${current ? "border-blue-300 bg-blue-50/40" : "border-zinc-200 dark:border-zinc-800"} ${isCompanySetup || isOpportunityDiscovery ? "relative" : ""}`}
								>
									{isOpportunityDiscovery && (
										<Link
											href="/opportunities"
											aria-label="Exploring opportunities — open dashboard"
											className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-transparent z-10"
										/>
									)}
									{isCompanySetup && (
										<Link
											href="/company-setup"
											aria-label="Company Setup"
											className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-transparent z-10"
										/>
									)}
									<div className="flex items-center gap-3 justify-between">
										<div className="flex items-center gap-3">
											<div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${completed ? "bg-green-600 text-white" : current ? "bg-blue-600 text-white" : "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"}`}>
												{completed ? (
													<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
														<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 5.293 11.879a1 1 0 111.414-1.414L8.414 12.172l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" />
													</svg>
												) : (
													step.id
												)}
											</div>
											<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{step.title}</h3>
										</div>
										<div>{renderBadge(step.id)}</div>
									</div>
									<p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
								</li>
							);
						})}
					</ol>
				</section>
			</div>
		</main>
	);
}


