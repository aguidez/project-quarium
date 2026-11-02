import { bootstrap } from "shared/framework";
import { AbyssService } from "./services/AbyssService";
import { AdminService } from "./services/AdminService";
import { AquariumService } from "./services/AquariumService";
import { CoinService } from "./services/CoinService";
import { CompanionService } from "./services/CompanionService";
import { CustomizationService } from "./services/CustomizationService";
import { DataService } from "./services/DataService";
import { DevCommandService } from "./services/DevCommandService";
import { EggService } from "./services/EggService";
import { EventService } from "./services/EventService";
import { FishService } from "./services/FishService";
import { FoodService } from "./services/FoodService";
import { GamePassService } from "./services/GamePassService";
import { TitleService } from "./services/TitleService";
import { InteractionService } from "./services/InteractionService";
import { LeaderboardService } from "./services/LeaderboardService";
import { LikeService } from "./services/LikeService";
import { OnboardingService } from "./services/OnboardingService";
import { OceanService } from "./services/OceanService";
import { QuestService } from "./services/QuestService";
import { RebirthService } from "./services/RebirthService";
import { StarfallService } from "./services/StarfallService";
import { StatsService } from "./services/StatsService";
import { UfoService } from "./services/UfoService";

// Register all server services here
bootstrap([
	DataService,
	InteractionService,
	AquariumService,
	FoodService,
	CoinService,
	FishService,
	EggService,
	OnboardingService,
	AbyssService,
	UfoService,
	StarfallService,
	EventService,
	AdminService,
	CompanionService,
	QuestService,
	OceanService,
	LikeService,
	RebirthService,
	GamePassService,
	TitleService,
	CustomizationService,
	StatsService,
	LeaderboardService,
	DevCommandService,
]);
