
"use client";

import React, { useEffect, useState } from "react";
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
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		async function load() {
			setLoading(true);
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();

				if (!user) {
					// no logged-in user
					if (mounted) setUserId(null);
					setLoading(false);
					return;
				}

				if (mounted) setUserId(user.id);

				// fetch current_step from user_journey table
				const { data, error } = await supabase
					.from("user_journey")
					.select("current_step")
					.eq("user_id", user.id)
					.maybeSingle();

				if (error) {
					console.error("Supabase query error", error);
					if (mounted) setError(error.message);
				} else if (data && data.current_step != null) {
					if (mounted) setCurrentStep(Number(data.current_step));
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

		// listen for auth changes (optional)
		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.user) {
				setUserId(session.user.id);
				// refetch when user signs in
				(async () => {
					const { data, error } = await supabase
						.from("user_journey")
						.select("current_step")
						.eq("user_id", session.user.id)
						.maybeSingle();
					if (!error && data && data.current_step != null) setCurrentStep(Number(data.current_step));
				})();
			} else {
				setUserId(null);
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
					<div className="mt-6">
						<a id="get-started" href="#journey" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-md shadow">
							Get Started
						</a>
					</div>
				</header>

				{/* Journey Tracker */}
				<section aria-labelledby="journey" className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur rounded-2xl p-6 sm:p-8 shadow">
					<div className="flex items-start justify-between">
						<h2 id="journey" className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
							Journey Tracker
						</h2>
						<div className="text-sm text-zinc-600 dark:text-zinc-400">
							{loading ? "Loading..." : userId ? `User: ${userId}` : "Not signed in"}
						</div>
					</div>

					{error && <div className="text-sm text-red-600 mb-4">Error: {error}</div>}

					<ol className="grid grid-cols-1 sm:grid-cols-4 gap-4">
						{STEPS.map((step) => {
							const completed = currentStep != null && step.id < currentStep;
							const current = currentStep === step.id;
							return (
								<li key={step.id} className={`flex flex-col gap-3 p-4 rounded-lg border ${current ? "border-blue-300 bg-blue-50/40" : "border-zinc-200 dark:border-zinc-800"}`}>
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


