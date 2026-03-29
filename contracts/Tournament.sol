// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Tournament
 * @dev Sit & Go Tournament Contract for Texas Hold'em Poker
 * Supports 2/3/6 player SNG and 9 player scheduled tournaments
 */
contract Tournament is ReentrancyGuard, Ownable, Pausable {
    
    // ============ Enums ============
    
    enum TournamentType { SNG, SCHEDULED }
    enum StartMode { INSTANT, SCHEDULED }
    enum TournamentStatus { WAITING, IN_PROGRESS, COMPLETED, CANCELLED }
    
    // ============ Structs ============
    
    struct TournamentConfig {
        TournamentType tournamentType;
        uint8 playerCount;           // 2, 3, 6, or 9
        uint256 buyIn;               // Buy-in amount in SUN
        uint256 rakeRate;            // Rake rate in basis points (500 = 5%)
        uint256[] prizeDistribution; // Percentages for each position (sum = 100)
        uint256 initialChips;        // Starting chips for each player
        StartMode startMode;
        uint256 waitTimeout;         // Wait timeout in seconds for scheduled
    }
    
    struct TournamentInfo {
        uint256 configId;
        TournamentStatus status;
        address[] players;
        uint256 prizePool;
        uint256 rakeCollected;
        uint256 startTime;
        uint256 endTime;
        address[] finalRankings;
        mapping(address => uint256) prizes;
        mapping(address => bool) hasClaimed;
    }
    
    // ============ State Variables ============
    
    address public serverWallet;
    address public chipToken;          // CHIP token address for rewards
    
    uint256 public tournamentCounter;
    mapping(uint256 => TournamentConfig) public configs;
    mapping(uint256 => TournamentInfo) public tournaments;
    mapping(address => uint256) public playerCurrentTournament;
    
    uint256[] public activeTournaments;
    
    // ============ Events ============
    
    event TournamentConfigCreated(uint256 indexed configId, TournamentType tournamentType, uint8 playerCount);
    event TournamentCreated(uint256 indexed tournamentId, uint256 indexed configId);
    event PlayerJoined(uint256 indexed tournamentId, address indexed player, uint8 position);
    event PlayerLeft(uint256 indexed tournamentId, address indexed player);
    event TournamentStarted(uint256 indexed tournamentId, uint256 prizePool, uint256 playerCount);
    event TournamentFinished(uint256 indexed tournamentId, address[] rankings, uint256 rakeCollected);
    event PrizeClaimed(uint256 indexed tournamentId, address indexed player, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);
    
    // ============ Modifiers ============
    
    modifier onlyServer() {
        require(msg.sender == serverWallet, "Tournament: caller is not server");
        _;
    }
    
    modifier notInTournament() {
        require(playerCurrentTournament[msg.sender] == 0, "Tournament: already in tournament");
        _;
    }
    
    modifier tournamentExists(uint256 tournamentId) {
        require(tournamentId > 0 && tournamentId <= tournamentCounter, "Tournament: does not exist");
        _;
    }
    
    modifier tournamentWaiting(uint256 tournamentId) {
        require(tournaments[tournamentId].status == TournamentStatus.WAITING, "Tournament: not waiting");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _serverWallet, address _chipToken)  {
        require(_serverWallet != address(0), "Tournament: invalid server wallet");
        serverWallet = _serverWallet;
        chipToken = _chipToken;
        tournamentCounter = 0;
        
        // Initialize default tournament configurations
        _initializeDefaultConfigs();
    }
    
    /**
     * @dev Initialize default tournament configurations
     */
    function _initializeDefaultConfigs() internal {
        // Config 1: 2-player SNG, 100 TRX buy-in, 5% rake, 70/30 split
        uint256[] memory prize2 = new uint256[](2);
        prize2[0] = 70;
        prize2[1] = 30;
        configs[1] = TournamentConfig({
            tournamentType: TournamentType.SNG,
            playerCount: 2,
            buyIn: 100 * 1e6,         // 100 TRX
            rakeRate: 500,            // 5%
            prizeDistribution: prize2,
            initialChips: 1000,       // 1000 starting chips
            startMode: StartMode.INSTANT,
            waitTimeout: 0
        });
        
        // Config 2: 3-player SNG, 50 TRX buy-in, 5% rake, 50/30/20 split
        uint256[] memory prize3 = new uint256[](3);
        prize3[0] = 50;
        prize3[1] = 30;
        prize3[2] = 20;
        configs[2] = TournamentConfig({
            tournamentType: TournamentType.SNG,
            playerCount: 3,
            buyIn: 50 * 1e6,          // 50 TRX
            rakeRate: 500,            // 5%
            prizeDistribution: prize3,
            initialChips: 1500,
            startMode: StartMode.INSTANT,
            waitTimeout: 0
        });
        
        // Config 3: 6-player SNG, 50 TRX buy-in, 5% rake, 50/30/20 split
        uint256[] memory prize6 = new uint256[](3);
        prize6[0] = 50;
        prize6[1] = 30;
        prize6[2] = 20;
        configs[3] = TournamentConfig({
            tournamentType: TournamentType.SNG,
            playerCount: 6,
            buyIn: 50 * 1e6,          // 50 TRX
            rakeRate: 500,            // 5%
            prizeDistribution: prize6,
            initialChips: 1500,
            startMode: StartMode.INSTANT,
            waitTimeout: 0
        });
        
        // Config 4: 9-player Scheduled, 100 TRX buy-in, 5% rake, 45/25/15/10/5 split
        uint256[] memory prize9 = new uint256[](5);
        prize9[0] = 45;
        prize9[1] = 25;
        prize9[2] = 15;
        prize9[3] = 10;
        prize9[4] = 5;
        configs[4] = TournamentConfig({
            tournamentType: TournamentType.SCHEDULED,
            playerCount: 9,
            buyIn: 100 * 1e6,         // 100 TRX
            rakeRate: 500,            // 5%
            prizeDistribution: prize9,
            initialChips: 2000,
            startMode: StartMode.SCHEDULED,
            waitTimeout: 5 minutes
        });
        
        tournamentCounter = 4;
    }
    
    // ============ Configuration Functions ============
    
    /**
     * @dev Create a new tournament configuration
     * @param _tournamentType SNG or SCHEDULED
     * @param _playerCount Number of players (2, 3, 6, or 9)
     * @param _buyIn Buy-in amount in SUN
     * @param _rakeRate Rake rate in basis points
     * @param _prizeDistribution Array of percentages for prize distribution
     * @param _initialChips Starting chips for each player
     * @param _startMode INSTANT or SCHEDULED
     * @param _waitTimeout Wait timeout in seconds
     */
    function createTournamentConfig(
        TournamentType _tournamentType,
        uint8 _playerCount,
        uint256 _buyIn,
        uint256 _rakeRate,
        uint256[] calldata _prizeDistribution,
        uint256 _initialChips,
        StartMode _startMode,
        uint256 _waitTimeout
    ) external onlyOwner returns (uint256) {
        require(_playerCount == 2 || _playerCount == 3 || _playerCount == 6 || _playerCount == 9, 
            "Tournament: invalid player count");
        require(_buyIn > 0, "Tournament: buy-in must be greater than 0");
        require(_rakeRate <= 1000, "Tournament: rake rate too high"); // Max 10%
        require(_prizeDistribution.length > 0, "Tournament: empty prize distribution");
        
        // Validate prize distribution sums to 100
        uint256 total = 0;
        for (uint256 i = 0; i < _prizeDistribution.length; i++) {
            total += _prizeDistribution[i];
        }
        require(total == 100, "Tournament: prize distribution must sum to 100");
        
        tournamentCounter++;
        uint256 configId = tournamentCounter;
        
        configs[configId] = TournamentConfig({
            tournamentType: _tournamentType,
            playerCount: _playerCount,
            buyIn: _buyIn,
            rakeRate: _rakeRate,
            prizeDistribution: _prizeDistribution,
            initialChips: _initialChips,
            startMode: _startMode,
            waitTimeout: _waitTimeout
        });
        
        emit TournamentConfigCreated(configId, _tournamentType, _playerCount);
        
        return configId;
    }
    
    // ============ Tournament Functions ============
    
    /**
     * @dev Create a new tournament from a configuration
     * @param configId The configuration ID to use
     */
    function createTournament(uint256 configId) external onlyServer returns (uint256) {
        require(configs[configId].playerCount > 0, "Tournament: config does not exist");
        
        tournamentCounter++;
        uint256 newTournamentId = tournamentCounter;
        
        TournamentInfo storage tournament = tournaments[newTournamentId];
        tournament.configId = configId;
        tournament.status = TournamentStatus.WAITING;
        tournament.prizePool = 0;
        tournament.rakeCollected = 0;
        tournament.startTime = 0;
        tournament.endTime = 0;
        
        activeTournaments.push(newTournamentId);
        
        emit TournamentCreated(newTournamentId, configId);
        
        return newTournamentId;
    }
    
    /**
     * @dev Join a tournament by paying the buy-in
     * @param tournamentId The tournament ID to join
     */
    function joinTournament(uint256 tournamentId) 
        external 
        payable 
        nonReentrant 
        whenNotPaused
        tournamentExists(tournamentId)
        tournamentWaiting(tournamentId)
        notInTournament
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        TournamentConfig storage config = configs[tournament.configId];
        
        require(msg.value == config.buyIn, "Tournament: incorrect buy-in amount");
        require(tournament.players.length < config.playerCount, "Tournament: already full");
        require(!hasPlayerJoined(tournamentId, msg.sender), "Tournament: already joined");
        
        tournament.players.push(msg.sender);
        tournament.prizePool += msg.value;
        playerCurrentTournament[msg.sender] = tournamentId;
        
        emit PlayerJoined(tournamentId, msg.sender, uint8(tournament.players.length));
    }
    
    /**
     * @dev Cancel join and get refund
     * @param tournamentId The tournament ID
     */
    function cancelJoin(uint256 tournamentId) 
        external 
        nonReentrant 
        tournamentExists(tournamentId)
        tournamentWaiting(tournamentId)
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        TournamentConfig storage config = configs[tournament.configId];
        
        require(hasPlayerJoined(tournamentId, msg.sender), "Tournament: not joined");
        
        // Find and remove player
        uint256 playerIndex = findPlayerIndex(tournamentId, msg.sender);
        require(playerIndex < tournament.players.length, "Tournament: player not found");
        
        // Remove player by swapping with last and popping
        tournament.players[playerIndex] = tournament.players[tournament.players.length - 1];
        tournament.players.pop();
        
        tournament.prizePool -= config.buyIn;
        playerCurrentTournament[msg.sender] = 0;
        
        // Refund
        (bool success, ) = payable(msg.sender).call{value: config.buyIn}("");
        require(success, "Tournament: refund failed");
        
        emit PlayerLeft(tournamentId, msg.sender);
    }
    
    /**
     * @dev Start the tournament (only server)
     * @param tournamentId The tournament ID
     */
    function startTournament(uint256 tournamentId) 
        external 
        onlyServer 
        tournamentExists(tournamentId)
        tournamentWaiting(tournamentId)
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        TournamentConfig storage config = configs[tournament.configId];
        
        require(tournament.players.length == config.playerCount, "Tournament: not full");
        
        // Calculate rake
        uint256 totalPool = tournament.prizePool;
        tournament.rakeCollected = (totalPool * config.rakeRate) / 10000;
        tournament.prizePool = totalPool - tournament.rakeCollected;
        tournament.status = TournamentStatus.IN_PROGRESS;
        tournament.startTime = block.timestamp;
        
        emit TournamentStarted(tournamentId, tournament.prizePool, tournament.players.length);
    }
    
    /**
     * @dev Cancel tournament and refund all players
     * @param tournamentId The tournament ID
     */
    function cancelTournament(uint256 tournamentId) 
        external 
        onlyServer 
        tournamentExists(tournamentId)
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        require(tournament.status == TournamentStatus.WAITING, "Tournament: cannot cancel");
        
        tournament.status = TournamentStatus.CANCELLED;
        
        // Refund all players
        TournamentConfig storage config = configs[tournament.configId];
        uint256 buyIn = config.buyIn;
        
        for (uint256 i = 0; i < tournament.players.length; i++) {
            address player = tournament.players[i];
            playerCurrentTournament[player] = 0;
            
            (bool success, ) = payable(player).call{value: buyIn}("");
            require(success, "Tournament: refund failed");
        }
        
        tournament.prizePool = 0;
        
        emit TournamentCancelled(tournamentId);
    }
    
    /**
     * @dev Finish tournament and set final rankings
     * @param tournamentId The tournament ID
     * @param rankings Array of player addresses in order of finish (winner first)
     */
    function finishTournament(uint256 tournamentId, address[] calldata rankings) 
        external 
        onlyServer 
        tournamentExists(tournamentId)
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        TournamentConfig storage config = configs[tournament.configId];
        
        require(tournament.status == TournamentStatus.IN_PROGRESS, "Tournament: not in progress");
        require(rankings.length == tournament.players.length, "Tournament: invalid rankings");
        
        tournament.status = TournamentStatus.COMPLETED;
        tournament.endTime = block.timestamp;
        tournament.finalRankings = rankings;
        
        // Calculate prizes based on distribution
        for (uint256 i = 0; i < rankings.length && i < config.prizeDistribution.length; i++) {
            uint256 prize = (tournament.prizePool * config.prizeDistribution[i]) / 100;
            tournament.prizes[rankings[i]] = prize;
        }
        
        // Clear player current tournament
        for (uint256 i = 0; i < tournament.players.length; i++) {
            playerCurrentTournament[tournament.players[i]] = 0;
        }
        
        // Transfer rake to server wallet
        if (tournament.rakeCollected > 0) {
            (bool success, ) = payable(serverWallet).call{value: tournament.rakeCollected}("");
            require(success, "Tournament: rake transfer failed");
        }
        
        emit TournamentFinished(tournamentId, rankings, tournament.rakeCollected);
    }
    
    /**
     * @dev Claim prize for finished tournament
     * @param tournamentId The tournament ID
     */
    function claimPrize(uint256 tournamentId) 
        external 
        nonReentrant 
        tournamentExists(tournamentId)
    {
        TournamentInfo storage tournament = tournaments[tournamentId];
        
        require(tournament.status == TournamentStatus.COMPLETED, "Tournament: not completed");
        require(!tournament.hasClaimed[msg.sender], "Tournament: already claimed");
        require(tournament.prizes[msg.sender] > 0, "Tournament: no prize");
        
        uint256 prize = tournament.prizes[msg.sender];
        tournament.hasClaimed[msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: prize}("");
        require(success, "Tournament: prize transfer failed");
        
        emit PrizeClaimed(tournamentId, msg.sender, prize);
    }
    
    // ============ View Functions ============
    
    function getTournamentConfig(uint256 configId) external view returns (
        TournamentType tournamentType,
        uint8 playerCount,
        uint256 buyIn,
        uint256 rakeRate,
        uint256[] memory prizeDistribution,
        uint256 initialChips,
        StartMode startMode,
        uint256 waitTimeout
    ) {
        TournamentConfig storage config = configs[configId];
        return (
            config.tournamentType,
            config.playerCount,
            config.buyIn,
            config.rakeRate,
            config.prizeDistribution,
            config.initialChips,
            config.startMode,
            config.waitTimeout
        );
    }
    
    function getTournamentInfo(uint256 tournamentId) external view returns (
        uint256 configId,
        TournamentStatus status,
        address[] memory players,
        uint256 prizePool,
        uint256 rakeCollected,
        uint256 startTime,
        uint256 endTime,
        address[] memory finalRankings
    ) {
        TournamentInfo storage tournament = tournaments[tournamentId];
        return (
            tournament.configId,
            tournament.status,
            tournament.players,
            tournament.prizePool,
            tournament.rakeCollected,
            tournament.startTime,
            tournament.endTime,
            tournament.finalRankings
        );
    }
    
    function getPlayerPrize(uint256 tournamentId, address player) external view returns (uint256) {
        return tournaments[tournamentId].prizes[player];
    }
    
    function hasPlayerJoined(uint256 tournamentId, address player) public view returns (bool) {
        TournamentInfo storage tournament = tournaments[tournamentId];
        for (uint256 i = 0; i < tournament.players.length; i++) {
            if (tournament.players[i] == player) {
                return true;
            }
        }
        return false;
    }
    
    function findPlayerIndex(uint256 tournamentId, address player) public view returns (uint256) {
        TournamentInfo storage tournament = tournaments[tournamentId];
        for (uint256 i = 0; i < tournament.players.length; i++) {
            if (tournament.players[i] == player) {
                return i;
            }
        }
        return tournament.players.length; // Not found
    }
    
    function getActiveTournaments() external view returns (uint256[] memory) {
        return activeTournaments;
    }
    
    function getTournamentPlayers(uint256 tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].players;
    }
    
    // ============ Admin Functions ============
    
    function setServerWallet(address _serverWallet) external onlyOwner {
        require(_serverWallet != address(0), "Tournament: invalid address");
        serverWallet = _serverWallet;
    }
    
    function setChipToken(address _chipToken) external onlyOwner {
        chipToken = _chipToken;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Emergency Functions ============
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Tournament: withdrawal failed");
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
