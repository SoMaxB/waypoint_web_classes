NAME = libftprintf.a

CC = cc
CFLAGS = -Wall -Wextra -Werror
AR = ar rcs
RM = rm -f

SRCS = ft_printf.c ft_parse.c ft_format.c ft_format_text.c \
	ft_format_numbers.c ft_format_hex.c ft_format_pointer.c \
	ft_number_core.c ft_output.c ft_utils.c
BONUS_SRCS = $(SRCS) ft_bonus_bonus.c
OBJS = $(SRCS:.c=.o)
BONUS_OBJS = $(BONUS_SRCS:.c=.o)
BONUS_STAMP = .bonus

all: $(NAME)

$(NAME): $(OBJS)
	$(AR) $(NAME) $(OBJS)

bonus: $(BONUS_STAMP)

$(BONUS_STAMP): $(BONUS_OBJS)
	$(AR) $(NAME) $(BONUS_OBJS)
	touch $(BONUS_STAMP)

%.o: %.c ft_printf.h
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	$(RM) $(OBJS) $(BONUS_OBJS) $(BONUS_STAMP)

fclean: clean
	$(RM) $(NAME)

re: fclean all

.PHONY: all clean fclean re bonus
