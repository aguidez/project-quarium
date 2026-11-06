import { bootstrap } from "shared/framework";
import { AbyssEventController } from "./controllers/AbyssEventController";
import { UfoEventController } from "./controllers/UfoEventController";
import { StarfallEventController } from "./controllers/StarfallEventController";
import { AquariumInteractionController } from "./controllers/AquariumInteractionController";
import { AudioController } from "./controllers/AudioController";
import { ChatTitleController } from "./controllers/ChatTitleController";
import { CapacityPlaqueController } from "./controllers/CapacityPlaqueController";
import { IncomePlaqueController } from "./controllers/IncomePlaqueController";
import { FishAnimationController } from "./controllers/FishAnimationController";
import { FishIndicatorController } from "./controllers/FishIndicatorController";
import { FishRenderController } from "./controllers/FishRenderController";
import { FishRigController } from "./controllers/FishRigController";
import { FocusController } from "./controllers/FocusController";
import { HudController } from "./controllers/HudController";
import { IncomePopupController } from "./controllers/IncomePopupController";
import { LeaderboardController } from "./controllers/LeaderboardController";
import { LikeBoardController } from "./controllers/LikeBoardController";
import { MusicEventController } from "./controllers/MusicEventController";
import { OnboardingController } from "./controllers/OnboardingController";
import { PelicanChargesController } from "./controllers/PelicanChargesController";
import { CompanionAnimationController } from "./controllers/CompanionAnimationController";
import { ShopKeeperController } from "./controllers/ShopKeeperController";
import { StatsReportController } from "./controllers/StatsReportController";
import { UiController } from "./controllers/UiController";

// Register all client controllers here
bootstrap([
	UiController,
	HudController,
	FocusController,
	AquariumInteractionController,
	FishRenderController,
	FishIndicatorController,
	FishAnimationController,
	FishRigController,
	IncomePopupController,
	AudioController,
	OnboardingController,
	CapacityPlaqueController,
	IncomePlaqueController,
	MusicEventController,
	AbyssEventController,
	UfoEventController,
	StarfallEventController,
	LikeBoardController,
	LeaderboardController,
	PelicanChargesController,
	CompanionAnimationController,
	ShopKeeperController,
	StatsReportController,
	ChatTitleController,
]);
