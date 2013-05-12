package server

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"log"
)

type playfield struct {
	Tiles          [][]int
	unitsPerPlayer []int
}

const (
	FIRST_PLAYER_TILE = 100
)

func readFieldsFromFolder(folder string) map[int][]*playfield {
	fo, err := os.Open(folder)
	d(err)
	files, err := fo.Readdirnames(-1)
	d(err)

	ret := make(map[int][]*playfield)
	for _, file := range files {
		if file[0] != '.' {
			field := readFieldFromFile(filepath.Join(folder, file))
			fields, exists := ret[len(field.unitsPerPlayer)]
			if !exists {
				ret[len(field.unitsPerPlayer)] = make([]*playfield, 0)
				fields = ret[len(field.unitsPerPlayer)]
			}
			ret[len(field.unitsPerPlayer)] = append(fields, field)
		}
	}

	log.Printf("%v", ret)

	return ret
}

func readFieldFromFile(file string) *playfield {
	fi, err := os.Open(file)
	d(err)
	defer fi.Close()

	reader := bufio.NewReader(fi)
	tile := regexp.MustCompile(`(\d+)`)

	ret := make([][]int, 0, 256)

	tempslice := make([]int, 24)
	nPlayers := 0
	var line string
	for err == nil {
		line, err = reader.ReadString('\n')

		match := tile.FindAllStringSubmatch(line, -1)
		row := make([]int, len(match))
		for i, m := range match {
			num, _ := strconv.Atoi(m[1])
			row[i] = num
			playerId := num - FIRST_PLAYER_TILE
			if playerId > 0 {
				tempslice[playerId]++
			}
			if playerId >= nPlayers {
				nPlayers = playerId + 1
			}
		}
		ret = append(ret, row)
	}

	if (len(ret[0]) == 0) {
		log.Fatalf("Couldn't load \"%s\", possibly an error: %s\n", file, err)
	}

	return &playfield{Tiles: ret, unitsPerPlayer: tempslice[0:nPlayers]}
}

func d(err interface{}) {
	if err != nil {
		panic(err)
	}
}
